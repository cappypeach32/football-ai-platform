"""Seed the database with sample leagues, teams, matches, and predictions."""
import asyncio
import uuid
from datetime import datetime, timedelta, timezone
from sqlalchemy import text
from app.database import engine, AsyncSessionLocal
from app.models import (
    League, Team, Match, Prediction,
    MatchStatus, PredictionResult, BetType
)


LEAGUES = [
    {"name": "Premier League", "country": "England", "season": "2024/25", "tier": 1},
    {"name": "La Liga", "country": "Spain", "season": "2024/25", "tier": 1},
    {"name": "Bundesliga", "country": "Germany", "season": "2024/25", "tier": 1},
    {"name": "Serie A", "country": "Italy", "season": "2024/25", "tier": 1},
    {"name": "Ligue 1", "country": "France", "season": "2024/25", "tier": 1},
]

TEAMS_BY_LEAGUE = {
    "Premier League": [
        {"name": "Manchester City", "short_name": "MCI", "elo_rating": 1920.0, "attack_strength": 1.85, "defense_weakness": 0.65},
        {"name": "Arsenal", "short_name": "ARS", "elo_rating": 1880.0, "attack_strength": 1.75, "defense_weakness": 0.70},
        {"name": "Liverpool", "short_name": "LIV", "elo_rating": 1860.0, "attack_strength": 1.80, "defense_weakness": 0.72},
        {"name": "Chelsea", "short_name": "CHE", "elo_rating": 1780.0, "attack_strength": 1.55, "defense_weakness": 0.85},
        {"name": "Tottenham", "short_name": "TOT", "elo_rating": 1750.0, "attack_strength": 1.60, "defense_weakness": 0.90},
        {"name": "Manchester United", "short_name": "MUN", "elo_rating": 1730.0, "attack_strength": 1.45, "defense_weakness": 1.05},
        {"name": "Newcastle United", "short_name": "NEW", "elo_rating": 1760.0, "attack_strength": 1.50, "defense_weakness": 0.80},
        {"name": "Aston Villa", "short_name": "AVL", "elo_rating": 1770.0, "attack_strength": 1.55, "defense_weakness": 0.82},
    ],
    "La Liga": [
        {"name": "Real Madrid", "short_name": "RMA", "elo_rating": 1950.0, "attack_strength": 1.90, "defense_weakness": 0.60},
        {"name": "FC Barcelona", "short_name": "BAR", "elo_rating": 1900.0, "attack_strength": 1.85, "defense_weakness": 0.68},
        {"name": "Atletico Madrid", "short_name": "ATM", "elo_rating": 1840.0, "attack_strength": 1.55, "defense_weakness": 0.65},
        {"name": "Athletic Bilbao", "short_name": "ATH", "elo_rating": 1720.0, "attack_strength": 1.40, "defense_weakness": 0.88},
        {"name": "Real Sociedad", "short_name": "SOC", "elo_rating": 1710.0, "attack_strength": 1.38, "defense_weakness": 0.90},
        {"name": "Villarreal", "short_name": "VIL", "elo_rating": 1700.0, "attack_strength": 1.42, "defense_weakness": 0.92},
    ],
    "Bundesliga": [
        {"name": "Bayer Leverkusen", "short_name": "LEV", "elo_rating": 1880.0, "attack_strength": 1.80, "defense_weakness": 0.62},
        {"name": "Bayern Munich", "short_name": "BAY", "elo_rating": 1900.0, "attack_strength": 1.85, "defense_weakness": 0.65},
        {"name": "Borussia Dortmund", "short_name": "BVB", "elo_rating": 1820.0, "attack_strength": 1.70, "defense_weakness": 0.85},
        {"name": "RB Leipzig", "short_name": "RBL", "elo_rating": 1800.0, "attack_strength": 1.60, "defense_weakness": 0.78},
        {"name": "VfB Stuttgart", "short_name": "STU", "elo_rating": 1740.0, "attack_strength": 1.45, "defense_weakness": 0.88},
    ],
    "Serie A": [
        {"name": "Inter Milan", "short_name": "INT", "elo_rating": 1870.0, "attack_strength": 1.72, "defense_weakness": 0.65},
        {"name": "AC Milan", "short_name": "MIL", "elo_rating": 1820.0, "attack_strength": 1.65, "defense_weakness": 0.72},
        {"name": "Juventus", "short_name": "JUV", "elo_rating": 1800.0, "attack_strength": 1.55, "defense_weakness": 0.70},
        {"name": "Napoli", "short_name": "NAP", "elo_rating": 1780.0, "attack_strength": 1.60, "defense_weakness": 0.80},
        {"name": "AS Roma", "short_name": "ROM", "elo_rating": 1750.0, "attack_strength": 1.50, "defense_weakness": 0.85},
    ],
    "Ligue 1": [
        {"name": "Paris Saint-Germain", "short_name": "PSG", "elo_rating": 1920.0, "attack_strength": 1.88, "defense_weakness": 0.62},
        {"name": "Olympique de Marseille", "short_name": "OM", "elo_rating": 1760.0, "attack_strength": 1.50, "defense_weakness": 0.85},
        {"name": "Monaco", "short_name": "MON", "elo_rating": 1740.0, "attack_strength": 1.48, "defense_weakness": 0.88},
        {"name": "Lille OSC", "short_name": "LIL", "elo_rating": 1720.0, "attack_strength": 1.42, "defense_weakness": 0.90},
        {"name": "Olympique Lyonnais", "short_name": "OL", "elo_rating": 1710.0, "attack_strength": 1.40, "defense_weakness": 0.92},
    ],
}

SAMPLE_MATCHES = [
    # Premier League upcoming
    {"home": "Arsenal", "away": "Manchester City", "days_ahead": 1, "status": MatchStatus.SCHEDULED},
    {"home": "Liverpool", "away": "Chelsea", "days_ahead": 1, "status": MatchStatus.SCHEDULED},
    {"home": "Tottenham", "away": "Newcastle United", "days_ahead": 2, "status": MatchStatus.SCHEDULED},
    {"home": "Manchester United", "away": "Aston Villa", "days_ahead": 3, "status": MatchStatus.SCHEDULED},
    # La Liga upcoming
    {"home": "FC Barcelona", "away": "Real Madrid", "days_ahead": 2, "status": MatchStatus.SCHEDULED},
    {"home": "Atletico Madrid", "away": "Athletic Bilbao", "days_ahead": 3, "status": MatchStatus.SCHEDULED},
    # Bundesliga upcoming
    {"home": "Bayern Munich", "away": "Bayer Leverkusen", "days_ahead": 2, "status": MatchStatus.SCHEDULED},
    {"home": "Borussia Dortmund", "away": "RB Leipzig", "days_ahead": 4, "status": MatchStatus.SCHEDULED},
    # Serie A upcoming
    {"home": "Inter Milan", "away": "Napoli", "days_ahead": 3, "status": MatchStatus.SCHEDULED},
    # Finished matches
    {"home": "PSG", "away": "Monaco", "days_ahead": -2, "status": MatchStatus.FINISHED, "home_score": 3, "away_score": 1},
    {"home": "Real Madrid", "away": "Atletico Madrid", "days_ahead": -3, "status": MatchStatus.FINISHED, "home_score": 2, "away_score": 0},
    {"home": "Manchester City", "away": "Liverpool", "days_ahead": -4, "status": MatchStatus.FINISHED, "home_score": 1, "away_score": 2},
]

PREDICTIONS = {
    "Arsenal": {
        "away": "Manchester City",
        "home_win_prob": 0.38, "draw_prob": 0.28, "away_win_prob": 0.34,
        "over_25_prob": 0.68, "under_25_prob": 0.32,
        "btts_yes_prob": 0.65, "btts_no_prob": 0.35,
        "home_xg": 1.72, "away_xg": 1.85,
        "confidence_score": 74.0, "risk_score": 42.0,
        "value_bet": True, "recommended_bet": BetType.OVER_25,
        "odds_home": 2.10, "odds_draw": 3.40, "odds_away": 3.20,
        "ai_summary": "High-octane clash between two title contenders. Both teams averaging over 2.5 goals in recent outings. Arsenal's Saka and Martinelli create relentless pressure while City's Haaland punishes any defensive lapse.",
        "key_factors": ["Both teams averaging 2.8 goals per game (last 5)", "Arsenal unbeaten at Emirates (7 games)", "City missing Rodri in midfield", "Over 2.5 has landed in 4/5 head-to-heads"],
    },
    "Liverpool": {
        "away": "Chelsea",
        "home_win_prob": 0.52, "draw_prob": 0.24, "away_win_prob": 0.24,
        "over_25_prob": 0.72, "under_25_prob": 0.28,
        "btts_yes_prob": 0.60, "btts_no_prob": 0.40,
        "home_xg": 2.10, "away_xg": 1.30,
        "confidence_score": 81.0, "risk_score": 28.0,
        "value_bet": True, "recommended_bet": BetType.HOME_WIN,
        "odds_home": 1.75, "odds_draw": 3.80, "odds_away": 4.50,
        "ai_summary": "Liverpool in exceptional home form with 6 consecutive wins at Anfield. Chelsea's defensive instability (1.8 goals conceded away) plays into the Reds' attacking strengths. Strong value on Liverpool win.",
        "key_factors": ["Liverpool 6W-0D-0L at Anfield (last 6)", "Chelsea conceding 1.8 per away game", "Salah 8 goals in last 6 home games", "ELO gap: +80 in Liverpool's favour"],
    },
    "FC Barcelona": {
        "away": "Real Madrid",
        "home_win_prob": 0.42, "draw_prob": 0.25, "away_win_prob": 0.33,
        "over_25_prob": 0.75, "under_25_prob": 0.25,
        "btts_yes_prob": 0.70, "btts_no_prob": 0.30,
        "home_xg": 1.95, "away_xg": 1.75,
        "confidence_score": 70.0, "risk_score": 45.0,
        "value_bet": False, "recommended_bet": BetType.BTTS_YES,
        "odds_home": 2.20, "odds_draw": 3.30, "odds_away": 3.10,
        "ai_summary": "El Clásico — the biggest fixture in world football. Both teams in scintillating form with elite attacking outputs. Expect goals in both halves. Lewandowski vs Bellingham battle key.",
        "key_factors": ["Both teams scored in last 8 H2H meetings", "Barcelona averaging 2.6 xG at home", "Vinicius Jr form: 5 goals in 4 games", "High-press game likely to create open spaces"],
    },
    "Bayern Munich": {
        "away": "Bayer Leverkusen",
        "home_win_prob": 0.45, "draw_prob": 0.26, "away_win_prob": 0.29,
        "over_25_prob": 0.78, "under_25_prob": 0.22,
        "btts_yes_prob": 0.68, "btts_no_prob": 0.32,
        "home_xg": 2.05, "away_xg": 1.80,
        "confidence_score": 76.0, "risk_score": 38.0,
        "value_bet": True, "recommended_bet": BetType.OVER_25,
        "odds_home": 2.05, "odds_draw": 3.50, "odds_away": 3.40,
        "ai_summary": "Bundesliga title race showdown. Two of Europe's most attack-minded teams meet at Allianz Arena. Over 2.5 goals has landed in every H2H this season. Bayern's home crowd advantage edges the contest.",
        "key_factors": ["Over 2.5 in 5/5 Bundesliga H2H this season", "Leverkusen's xG away: 1.8 per game", "Kane vs Granit Xhaka pivot battle", "Bayern's Allianz Arena fortress effect"],
    },
    "Inter Milan": {
        "away": "Napoli",
        "home_win_prob": 0.48, "draw_prob": 0.28, "away_win_prob": 0.24,
        "over_25_prob": 0.55, "under_25_prob": 0.45,
        "btts_yes_prob": 0.58, "btts_no_prob": 0.42,
        "home_xg": 1.65, "away_xg": 1.35,
        "confidence_score": 69.0, "risk_score": 35.0,
        "value_bet": False, "recommended_bet": BetType.HOME_WIN,
        "odds_home": 1.95, "odds_draw": 3.40, "odds_away": 3.80,
        "ai_summary": "Serie A top-of-table battle. Inter's tactical superiority at San Siro gives them the edge, though Napoli's defensive solidity will make this a tight affair. Expect an efficient 1-0 or 2-1.",
        "key_factors": ["Inter 4W-1D at home this season", "Napoli scoring 1.2 goals per away game", "Lautaro Martinez on 7-game scoring streak", "Tactical match-up favours Inzaghi's system"],
    },
}


async def seed():
    async with AsyncSessionLocal() as session:
        # Check if already seeded
        result = await session.execute(text("SELECT COUNT(*) FROM leagues"))
        count = result.scalar()
        if count > 0:
            print(f"✅ Database already has {count} leagues — skipping seed.")
            return

        # ── Leagues ──
        league_map = {}
        for ld in LEAGUES:
            league = League(**ld)
            session.add(league)
            league_map[ld["name"]] = league
        await session.flush()

        # ── Teams ──
        team_map = {}
        for league_name, teams in TEAMS_BY_LEAGUE.items():
            league = league_map[league_name]
            for td in teams:
                team = Team(league_id=league.id, country=league.country, **td)
                session.add(team)
                team_map[td["name"]] = team

        await session.commit()
        print("✅ Database seeded: 5 leagues and teams. Matches come from ESPN via fetch_matches.py.")


if __name__ == "__main__":
    asyncio.run(seed())
