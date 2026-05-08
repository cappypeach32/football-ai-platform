"""
Data Normalization Layer
========================
Converts validated raw ESPN data into canonical internal records.

Responsibilities:
  - Canonical team name mapping (handles ESPN name variants)
  - Status string → internal MatchStatus enum
  - Score parsing (string → int | None, respects match status)
  - Minute extraction from displayClock
  - Referee extraction from competition officials
  - Produces typed dataclasses: NormalizedMatch, NormalizedTeam, NormalizedLeague

The downstream pipeline (pipeline.py) only works with these typed records,
never with raw dict/JSON.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone

from app.data_engine.validation import RawEvent, RawCompetitor
from app.models import MatchStatus

logger = logging.getLogger(__name__)


# ── Team name canonical aliases ──────────────────────────────────────────────
# ESPN sometimes uses abbreviations or alternate names across different endpoints.
# Format: "variant" → "canonical"
_TEAM_ALIASES: dict[str, str] = {
    # England
    "Man United":             "Manchester United",
    "Man Utd":                "Manchester United",
    "Manchester Utd":         "Manchester United",
    "Man City":               "Manchester City",
    "Manchester City FC":     "Manchester City",
    "Spurs":                  "Tottenham Hotspur",
    "Tottenham":              "Tottenham Hotspur",
    "Newcastle":              "Newcastle United",
    "Newcastle Utd":          "Newcastle United",
    "Wolves":                 "Wolverhampton Wanderers",
    "Wolverhampton":          "Wolverhampton Wanderers",
    "West Ham":               "West Ham United",
    "Leicester":              "Leicester City",
    "Leeds":                  "Leeds United",
    "Brighton":               "Brighton & Hove Albion",
    "Nottingham Forest":      "Nottingham Forest",
    "Forest":                 "Nottingham Forest",
    # Spain
    "Atletico":               "Atlético de Madrid",
    "Atletico Madrid":        "Atlético de Madrid",
    "Atletico de Madrid":     "Atlético de Madrid",
    "Betis":                  "Real Betis",
    "Real Betis Balompie":    "Real Betis",
    "Celta":                  "Celta Vigo",
    "Celta de Vigo":          "Celta Vigo",
    # Germany
    "Bayern":                 "Bayern Munich",
    "FC Bayern München":      "Bayern Munich",
    "Bayern München":         "Bayern Munich",
    "Dortmund":               "Borussia Dortmund",
    "BVB":                    "Borussia Dortmund",
    "Borussia MG":            "Borussia Mönchengladbach",
    "Gladbach":               "Borussia Mönchengladbach",
    "Leverkusen":             "Bayer Leverkusen",
    "Bayer 04":               "Bayer Leverkusen",
    "Hertha":                 "Hertha BSC",
    # Italy
    "Inter":                  "Inter Milan",
    "Internazionale":         "Inter Milan",
    "FC Internazionale":      "Inter Milan",
    "Inter Milan FC":         "Inter Milan",
    "Milan":                  "AC Milan",
    "AC Milan FC":            "AC Milan",
    "Juventus FC":            "Juventus",
    "Napoli FC":              "Napoli",
    "Roma":                   "AS Roma",
    "AS Roma FC":             "AS Roma",
    "Lazio":                  "SS Lazio",
    "Fiorentina":             "ACF Fiorentina",
    # France
    "Paris Saint-Germain FC": "Paris Saint-Germain",
    "PSG":                    "Paris Saint-Germain",
    "Lyon":                   "Olympique Lyonnais",
    "Marseille":              "Olympique de Marseille",
    "OM":                     "Olympique de Marseille",
    # Portugal
    "SL Benfica":             "Benfica",
    "FC Porto":               "Porto",
    "Sporting CP":            "Sporting CP",
    "Sporting Lisbon":        "Sporting CP",
    # UEFA
    "Ajax AFC":               "Ajax",
    "FC Barcelona":           "Barcelona",
    "Real Madrid CF":         "Real Madrid",
    "FC Chelsea":             "Chelsea",
    "FC Arsenal":             "Arsenal",
}

# ESPN status name → internal MatchStatus
_STATUS_MAP: dict[str, MatchStatus] = {
    "STATUS_SCHEDULED":   MatchStatus.SCHEDULED,
    "STATUS_IN_PROGRESS": MatchStatus.LIVE,
    "STATUS_HALFTIME":    MatchStatus.LIVE,
    "STATUS_FINAL":       MatchStatus.FINISHED,
    "STATUS_FULL_TIME":   MatchStatus.FINISHED,
    "STATUS_POSTPONED":   MatchStatus.POSTPONED,
    "STATUS_CANCELED":    MatchStatus.CANCELLED,
    "STATUS_SUSPENDED":   MatchStatus.POSTPONED,
    "STATUS_DELAYED":     MatchStatus.POSTPONED,
    "STATUS_RAIN_DELAY":  MatchStatus.POSTPONED,
    "STATUS_END_PERIOD":  MatchStatus.LIVE,
    "STATUS_OVERTIME":    MatchStatus.LIVE,
    "STATUS_SHOOTOUT":    MatchStatus.LIVE,
}


# ── Normalized dataclasses ────────────────────────────────────────────────────

@dataclass
class NormalizedTeam:
    espn_id: str             # numeric ESPN team id (e.g. "363")
    external_id: str         # our storage format (e.g. "espn_363")
    name: str                # canonical name
    short_name: str | None
    logo_url: str | None


@dataclass
class NormalizedLeague:
    slug: str                # ESPN slug (e.g. "ENG.1")
    name: str
    country: str
    tier: int
    season: str = "2025/26"


@dataclass
class NormalizedMatch:
    external_id: str         # "espn_{event_id}"
    match_date: datetime
    status: MatchStatus
    home_team: NormalizedTeam
    away_team: NormalizedTeam
    league: NormalizedLeague
    home_score: int | None   # None for scheduled matches
    away_score: int | None
    minute: int | None
    venue: str | None
    referee: str | None
    raw_status_name: str     # kept for debugging


# ── Normalization functions ───────────────────────────────────────────────────

def normalize_team_name(name: str) -> str:
    """Apply canonical alias mapping. Falls back to stripped original."""
    return _TEAM_ALIASES.get(name, name).strip()


def normalize_score(score_str: str | None, status: MatchStatus) -> int | None:
    """
    Parse score string to int.
    Returns None for scheduled matches (ESPN returns "0" before kickoff).
    """
    if status not in (MatchStatus.LIVE, MatchStatus.FINISHED):
        return None
    if score_str is None or score_str.strip() == "":
        return None
    try:
        return int(score_str.strip())
    except (ValueError, TypeError):
        return None


def normalize_minute(display_clock: str | None, status: MatchStatus) -> int | None:
    """Extract integer minute from ESPN displayClock (e.g. '45:30' → 45)."""
    if status != MatchStatus.LIVE or not display_clock:
        return None
    if display_clock in ("0:00", ""):
        return None
    try:
        return int(display_clock.split(":")[0])
    except (ValueError, IndexError):
        return None


def normalize_referee(competition_raw: dict) -> str | None:
    """Extract referee name from competition officials list."""
    try:
        for official in competition_raw.get("officials", []):
            role = official.get("position", {}).get("name", "").lower()
            if role in ("referee", "main referee", "center referee"):
                full_name = official.get("official", {}).get("displayName")
                if full_name:
                    return full_name
    except Exception:
        pass
    return None


def normalize_team(competitor: RawCompetitor) -> NormalizedTeam:
    raw_name = competitor.team.displayName
    canonical = normalize_team_name(raw_name)
    return NormalizedTeam(
        espn_id=competitor.team.id,
        external_id=f"espn_{competitor.team.id}",
        name=canonical,
        short_name=competitor.team.abbreviation,
        logo_url=competitor.team.logo,
    )


def normalize_event(event: RawEvent, league_meta: NormalizedLeague, raw_competition: dict) -> NormalizedMatch:
    """
    Convert a validated RawEvent into a NormalizedMatch.

    raw_competition is the original dict (for fields not captured in RawEvent,
    e.g. officials that Pydantic model treats as passthrough).
    """
    status_name = event.status.name
    status = _STATUS_MAP.get(status_name, MatchStatus.SCHEDULED)

    if status_name not in _STATUS_MAP:
        logger.warning("Unknown ESPN status %r — defaulting to SCHEDULED", status_name)

    home_comp = event.home_competitor
    away_comp = event.away_competitor

    home_score = normalize_score(home_comp.score, status)
    away_score = normalize_score(away_comp.score, status)
    minute = normalize_minute(event.status.clock, status)

    try:
        match_date = datetime.fromisoformat(event.date.replace("Z", "+00:00"))
    except ValueError:
        logger.warning("Invalid date format %r for event %s", event.date, event.id)
        match_date = datetime.now(tz=timezone.utc)

    venue = event.competition.venue.fullName if event.competition.venue else None
    referee = normalize_referee(raw_competition)

    return NormalizedMatch(
        external_id=f"espn_{event.id}",
        match_date=match_date,
        status=status,
        home_team=normalize_team(home_comp),
        away_team=normalize_team(away_comp),
        league=league_meta,
        home_score=home_score,
        away_score=away_score,
        minute=minute,
        venue=venue,
        referee=referee,
        raw_status_name=status_name,
    )
