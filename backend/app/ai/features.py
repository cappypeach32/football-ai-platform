"""
Match Feature Engineering
=========================
Computes the pre-match feature vector fed into all ML models.

Feature groups:
  ELO           — absolute ratings + differential
  Form (last 5) — PPG, goals scored/conceded averages
  H2H           — win rates and goal averages from last 5 meetings
  Congestion    — days since last match (fatigue proxy)
  Injuries      — count of missing players (applied as post-hoc adjustment)
  Shots         — average shots / shots-on-target last 5 (Phase 2 enrichment)
  Weather       — temperature, precipitation, wind (Phase 2)
  Referee       — foul rate profile (Phase 2)

XGB_FEATURE_NAMES must stay in sync with train_xgboost.py.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

import numpy as np

from app.schemas import TeamFormEntry, InjuredPlayerInfo, H2HResult

logger = logging.getLogger(__name__)

# ── Canonical feature order (MUST match train_xgboost.py) ────────────────────
XGB_FEATURE_NAMES: list[str] = [
    "elo_home",
    "elo_away",
    "elo_diff",
    "home_form_pts_5",
    "away_form_pts_5",
    "home_goals_scored_5",
    "home_goals_conceded_5",
    "away_goals_scored_5",
    "away_goals_conceded_5",
    "home_shots_5",
    "away_shots_5",
    "h2h_home_winrate",
    "h2h_draw_rate",
    "h2h_avg_total_goals",
    "home_days_rest",
    "away_days_rest",
]


@dataclass
class WeatherInfo:
    temperature: float = 15.0       # Celsius
    is_precipitation: bool = False   # rain/snow
    wind_speed: float = 5.0         # km/h
    condition: str = "clear"        # human-readable


@dataclass
class MatchFeatures:
    # ── ELO ──────────────────────────────────────────────────────────────────
    elo_home: float = 1500.0
    elo_away: float = 1500.0

    # ── Form (last 5 matches) ─────────────────────────────────────────────────
    home_form_pts_5: float = 1.2    # points per game
    away_form_pts_5: float = 1.2
    home_goals_scored_5: float = 1.3
    home_goals_conceded_5: float = 1.2
    away_goals_scored_5: float = 1.2
    away_goals_conceded_5: float = 1.3
    home_form_string: str = "— — — — —"
    away_form_string: str = "— — — — —"

    # ── Shots (Phase 2 enrichment, 0 when unavailable) ────────────────────────
    home_shots_5: float = 0.0
    away_shots_5: float = 0.0

    # ── H2H (last 5) ──────────────────────────────────────────────────────────
    h2h_home_winrate: float = 0.4
    h2h_draw_rate: float = 0.25
    h2h_avg_total_goals: float = 2.6

    # ── Congestion / fatigue ──────────────────────────────────────────────────
    home_days_rest: float = 7.0
    away_days_rest: float = 7.0

    # ── Injuries (post-hoc adjustment, NOT in XGBoost vector) ─────────────────
    home_injured_count: int = 0
    away_injured_count: int = 0
    home_suspended_count: int = 0
    away_suspended_count: int = 0

    # ── Weather (Phase 2) ─────────────────────────────────────────────────────
    weather: WeatherInfo = field(default_factory=WeatherInfo)

    # ── Referee ───────────────────────────────────────────────────────────────
    referee_foul_rate: float | None = None   # avg fouls per game

    # ── Raw form lists (for narrative generation) ─────────────────────────────
    home_form: list[TeamFormEntry] = field(default_factory=list)
    away_form: list[TeamFormEntry] = field(default_factory=list)
    h2h_results: list[H2HResult] = field(default_factory=list)

    # ── Computed properties ───────────────────────────────────────────────────

    @property
    def elo_diff(self) -> float:
        return self.elo_home - self.elo_away

    @property
    def home_missing_total(self) -> int:
        return self.home_injured_count + self.home_suspended_count

    @property
    def away_missing_total(self) -> int:
        return self.away_injured_count + self.away_suspended_count

    def to_xgb_vector(self) -> np.ndarray:
        """Returns the canonical feature vector for XGBoost prediction."""
        return np.array([
            self.elo_home,
            self.elo_away,
            self.elo_diff,
            self.home_form_pts_5,
            self.away_form_pts_5,
            self.home_goals_scored_5,
            self.home_goals_conceded_5,
            self.away_goals_scored_5,
            self.away_goals_conceded_5,
            self.home_shots_5,
            self.away_shots_5,
            self.h2h_home_winrate,
            self.h2h_draw_rate,
            self.h2h_avg_total_goals,
            self.home_days_rest,
            self.away_days_rest,
        ], dtype=np.float32)


# ── Feature extraction ────────────────────────────────────────────────────────

def _form_to_stats(form: list[TeamFormEntry], side: str) -> dict[str, float]:
    """
    Compute aggregate stats from last 5 form entries.

    Args:
        form:  list[TeamFormEntry], should be last 5 chronological
        side:  "home" or "away" (for logging)
    """
    if not form:
        logger.debug("No form data for %s team — using league averages", side)
        return {
            "pts_5": 1.2,
            "gf_5": 1.3 if side == "home" else 1.1,
            "ga_5": 1.1 if side == "home" else 1.3,
        }

    recent = form[-5:]  # safety: take last 5
    pts_map = {"W": 3, "D": 1, "L": 0}
    pts = [pts_map.get(e.result, 1) for e in recent]
    gf  = [e.goals_for for e in recent]
    ga  = [e.goals_against for e in recent]

    return {
        "pts_5": round(sum(pts) / len(pts), 3),
        "gf_5":  round(sum(gf) / len(gf), 3),
        "ga_5":  round(sum(ga) / len(ga), 3),
    }


def _h2h_to_stats(h2h: list[H2HResult], home_team_name: str) -> dict[str, float]:
    """Compute H2H win rates from last 5 results."""
    if not h2h:
        return {"home_wr": 0.40, "draw_r": 0.25, "avg_goals": 2.6}

    recent = h2h[-5:]
    home_wins = sum(
        1 for r in recent
        if (r.home_team == home_team_name and r.home_score > r.away_score)
        or (r.away_team == home_team_name and r.away_score > r.home_score)
    )
    draws = sum(1 for r in recent if r.home_score == r.away_score)
    avg_goals = sum(r.home_score + r.away_score for r in recent) / len(recent)

    n = len(recent)
    return {
        "home_wr":   round(home_wins / n, 3),
        "draw_r":    round(draws / n, 3),
        "avg_goals": round(avg_goals, 2),
    }


def _injuries_to_counts(
    injuries: list[InjuredPlayerInfo],
) -> tuple[int, int]:
    """Returns (injured_count, suspended_count)."""
    injured = sum(1 for p in injuries if p.status in ("injured", "doubtful", "out"))
    suspended = sum(1 for p in injuries if p.status == "suspended")
    return injured, suspended


def _form_string(form: list[TeamFormEntry]) -> str:
    return " ".join(e.result for e in form) if form else "— — — — —"


def extract_features(
    match: Any,                              # Match ORM object
    home_form: list[TeamFormEntry],
    away_form: list[TeamFormEntry],
    home_injuries: list[InjuredPlayerInfo],
    away_injuries: list[InjuredPlayerInfo],
    h2h: list[H2HResult],
    home_days_rest: float = 7.0,
    away_days_rest: float = 7.0,
    weather: WeatherInfo | None = None,
    referee_foul_rate: float | None = None,
) -> MatchFeatures:
    """
    Build a MatchFeatures object from all available data sources.

    Args:
        match:           SQLAlchemy Match ORM object (with home_team, away_team loaded)
        home_form:       Last 5 results for home team (from ESPN pipeline)
        away_form:       Last 5 results for away team
        home_injuries:   Injury/suspension list for home team
        away_injuries:   Injury/suspension list for away team
        h2h:             Last 5 H2H results
        home_days_rest:  Days since home team's last match
        away_days_rest:  Days since away team's last match
        weather:         WeatherInfo (Phase 2, optional)
        referee_foul_rate: Historical foul rate for this referee (optional)
    """
    home_team = match.home_team
    away_team = match.away_team

    # ── Form stats ────────────────────────────────────────────────────────────
    hf = _form_to_stats(home_form, "home")
    af = _form_to_stats(away_form, "away")

    # ── H2H stats ─────────────────────────────────────────────────────────────
    h2h_stats = _h2h_to_stats(h2h, home_team.name)

    # ── Injuries ──────────────────────────────────────────────────────────────
    h_inj, h_sus = _injuries_to_counts(home_injuries)
    a_inj, a_sus = _injuries_to_counts(away_injuries)

    return MatchFeatures(
        elo_home=float(home_team.elo_rating),
        elo_away=float(away_team.elo_rating),

        home_form_pts_5=hf["pts_5"],
        away_form_pts_5=af["pts_5"],
        home_goals_scored_5=hf["gf_5"],
        home_goals_conceded_5=hf["ga_5"],
        away_goals_scored_5=af["gf_5"],
        away_goals_conceded_5=af["ga_5"],
        home_form_string=_form_string(home_form),
        away_form_string=_form_string(away_form),

        h2h_home_winrate=h2h_stats["home_wr"],
        h2h_draw_rate=h2h_stats["draw_r"],
        h2h_avg_total_goals=h2h_stats["avg_goals"],

        home_days_rest=float(max(1.0, home_days_rest)),
        away_days_rest=float(max(1.0, away_days_rest)),

        home_injured_count=h_inj,
        away_injured_count=a_inj,
        home_suspended_count=h_sus,
        away_suspended_count=a_sus,

        weather=weather or WeatherInfo(),
        referee_foul_rate=referee_foul_rate,

        home_form=home_form,
        away_form=away_form,
        h2h_results=h2h,
    )
