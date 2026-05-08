"""Update ELO ratings and attack/defense stats for known top teams imported from ESPN."""
import asyncio
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.database import AsyncSessionLocal
from app.models import Team, Prediction, Match
from app.ai.engine import PredictionEngine

# Real 2025/26 approximate ELO + attack/defense ratings
# attack_strength: average goals scored per game (league average = 1.0)
# defense_weakness: average goals conceded per game (league average = 1.0)
TEAM_STATS = {
    # Premier League
    "Liverpool":                    {"elo": 1910, "atk": 1.82, "def": 0.68},
    "Arsenal":                      {"elo": 1875, "atk": 1.72, "def": 0.72},
    "Manchester City":              {"elo": 1890, "atk": 1.75, "def": 0.70},
    "Chelsea":                      {"elo": 1790, "atk": 1.55, "def": 0.88},
    "Nottingham Forest":            {"elo": 1740, "atk": 1.30, "def": 0.82},
    "Aston Villa":                  {"elo": 1780, "atk": 1.50, "def": 0.85},
    "Newcastle United":             {"elo": 1760, "atk": 1.45, "def": 0.80},
    "Tottenham Hotspur":            {"elo": 1750, "atk": 1.55, "def": 0.95},
    "Manchester United":            {"elo": 1720, "atk": 1.38, "def": 1.05},
    "Brighton & Hove Albion":       {"elo": 1730, "atk": 1.42, "def": 0.90},
    "West Ham United":              {"elo": 1700, "atk": 1.30, "def": 1.00},
    "Fulham":                       {"elo": 1710, "atk": 1.35, "def": 0.95},
    "Crystal Palace":               {"elo": 1680, "atk": 1.20, "def": 1.00},
    "Brentford":                    {"elo": 1690, "atk": 1.35, "def": 1.05},
    "Everton":                      {"elo": 1650, "atk": 1.10, "def": 1.10},
    "Burnley":                      {"elo": 1620, "atk": 1.10, "def": 1.15},
    "Sunderland":                   {"elo": 1640, "atk": 1.15, "def": 1.05},
    "Leeds United":                 {"elo": 1660, "atk": 1.25, "def": 1.00},
    # La Liga
    "Barcelona":                    {"elo": 1920, "atk": 1.90, "def": 0.65},
    "Real Madrid":                  {"elo": 1940, "atk": 1.88, "def": 0.62},
    "Atlético Madrid":              {"elo": 1850, "atk": 1.55, "def": 0.68},
    "Athletic Club":                {"elo": 1740, "atk": 1.40, "def": 0.85},
    "Real Sociedad":                {"elo": 1720, "atk": 1.38, "def": 0.90},
    "Villarreal":                   {"elo": 1710, "atk": 1.40, "def": 0.92},
    "Sevilla":                      {"elo": 1700, "atk": 1.30, "def": 1.00},
    "Real Betis":                   {"elo": 1695, "atk": 1.35, "def": 0.98},
    "Osasuna":                      {"elo": 1660, "atk": 1.20, "def": 1.05},
    "Celta Vigo":                   {"elo": 1650, "atk": 1.25, "def": 1.10},
    "Espanyol":                     {"elo": 1640, "atk": 1.15, "def": 1.05},
    "Mallorca":                     {"elo": 1630, "atk": 1.10, "def": 1.00},
    "Girona":                       {"elo": 1700, "atk": 1.45, "def": 0.95},
    "Rayo Vallecano":               {"elo": 1645, "atk": 1.20, "def": 1.08},
    "Valencia":                     {"elo": 1650, "atk": 1.25, "def": 1.05},
    "Getafe":                       {"elo": 1635, "atk": 1.10, "def": 1.05},
    "Alavés":                       {"elo": 1610, "atk": 1.05, "def": 1.15},
    "Levante":                      {"elo": 1600, "atk": 1.10, "def": 1.12},
    "Elche":                        {"elo": 1595, "atk": 1.05, "def": 1.18},
    # Bundesliga
    "Bayern Munich":                {"elo": 1930, "atk": 1.92, "def": 0.62},
    "Bayer Leverkusen":             {"elo": 1890, "atk": 1.80, "def": 0.65},
    "Borussia Dortmund":            {"elo": 1830, "atk": 1.68, "def": 0.88},
    "RB Leipzig":                   {"elo": 1810, "atk": 1.60, "def": 0.80},
    "VfB Stuttgart":                {"elo": 1760, "atk": 1.52, "def": 0.88},
    "Eintracht Frankfurt":          {"elo": 1740, "atk": 1.48, "def": 0.92},
    "VfL Wolfsburg":                {"elo": 1700, "atk": 1.32, "def": 1.00},
    "Borussia Mönchengladbach":     {"elo": 1690, "atk": 1.30, "def": 1.02},
    "SC Freiburg":                  {"elo": 1720, "atk": 1.35, "def": 0.90},
    "TSG Hoffenheim":               {"elo": 1680, "atk": 1.35, "def": 1.05},
    "Werder Bremen":                {"elo": 1690, "atk": 1.38, "def": 1.02},
    "Mainz":                        {"elo": 1700, "atk": 1.30, "def": 0.98},
    "FC Augsburg":                  {"elo": 1640, "atk": 1.15, "def": 1.10},
    "1. FC Union Berlin":           {"elo": 1650, "atk": 1.20, "def": 1.08},
    "Hamburg SV":                   {"elo": 1660, "atk": 1.22, "def": 1.05},
    "FC Cologne":                   {"elo": 1620, "atk": 1.10, "def": 1.12},
    "1. FC Heidenheim 1846":        {"elo": 1610, "atk": 1.08, "def": 1.15},
    "St. Pauli":                    {"elo": 1615, "atk": 1.05, "def": 1.10},
    # Serie A
    "Internazionale":               {"elo": 1880, "atk": 1.75, "def": 0.65},
    "AC Milan":                     {"elo": 1830, "atk": 1.65, "def": 0.72},
    "Juventus":                     {"elo": 1820, "atk": 1.55, "def": 0.72},
    "Napoli":                       {"elo": 1790, "atk": 1.60, "def": 0.80},
    "Atalanta":                     {"elo": 1810, "atk": 1.72, "def": 0.78},
    "Lazio":                        {"elo": 1760, "atk": 1.50, "def": 0.88},
    "AS Roma":                      {"elo": 1750, "atk": 1.48, "def": 0.90},
    "Fiorentina":                   {"elo": 1740, "atk": 1.45, "def": 0.92},
    "Bologna":                      {"elo": 1730, "atk": 1.40, "def": 0.92},
    "Torino":                       {"elo": 1680, "atk": 1.25, "def": 1.05},
    "Lecce":                        {"elo": 1620, "atk": 1.10, "def": 1.15},
    "Cagliari":                     {"elo": 1625, "atk": 1.12, "def": 1.12},
    "Udinese":                      {"elo": 1635, "atk": 1.15, "def": 1.08},
    "Parma":                        {"elo": 1615, "atk": 1.08, "def": 1.18},
    "Genoa":                        {"elo": 1620, "atk": 1.10, "def": 1.15},
    "Hellas Verona":                {"elo": 1610, "atk": 1.08, "def": 1.18},
    "Como":                         {"elo": 1605, "atk": 1.05, "def": 1.20},
    "Sassuolo":                     {"elo": 1590, "atk": 1.00, "def": 1.22},
    "Cremonese":                    {"elo": 1585, "atk": 0.98, "def": 1.25},
    "Pisa":                         {"elo": 1580, "atk": 0.95, "def": 1.22},
    # Ligue 1
    "Paris Saint-Germain":          {"elo": 1930, "atk": 1.95, "def": 0.60},
    "Marseille":                    {"elo": 1780, "atk": 1.55, "def": 0.85},
    "AS Monaco":                    {"elo": 1760, "atk": 1.52, "def": 0.88},
    "Lille":                        {"elo": 1750, "atk": 1.45, "def": 0.85},
    "Lyon":                         {"elo": 1730, "atk": 1.42, "def": 0.92},
    "Nice":                         {"elo": 1720, "atk": 1.38, "def": 0.90},
    "Lens":                         {"elo": 1700, "atk": 1.35, "def": 0.95},
    "Stade Rennais":                {"elo": 1690, "atk": 1.32, "def": 1.00},
    "Toulouse":                     {"elo": 1680, "atk": 1.28, "def": 1.02},
    "Brest":                        {"elo": 1685, "atk": 1.30, "def": 1.00},
    "Nantes":                       {"elo": 1650, "atk": 1.18, "def": 1.08},
    "AJ Auxerre":                   {"elo": 1630, "atk": 1.12, "def": 1.10},
    "Strasbourg":                   {"elo": 1640, "atk": 1.15, "def": 1.08},
    "Le Havre AC":                  {"elo": 1620, "atk": 1.08, "def": 1.12},
    "Metz":                         {"elo": 1610, "atk": 1.05, "def": 1.18},
    "Lorient":                      {"elo": 1600, "atk": 1.00, "def": 1.22},
    "Angers":                       {"elo": 1625, "atk": 1.10, "def": 1.12},
    "Paris FC":                     {"elo": 1615, "atk": 1.08, "def": 1.15},
    # Primeira Liga
    "Benfica":                      {"elo": 1860, "atk": 1.78, "def": 0.70},
    "Sporting CP":                  {"elo": 1850, "atk": 1.72, "def": 0.72},
    "FC Porto":                     {"elo": 1840, "atk": 1.68, "def": 0.72},
    "Braga":                        {"elo": 1740, "atk": 1.42, "def": 0.90},
    "Vitória de Guimaraes":         {"elo": 1680, "atk": 1.25, "def": 1.05},
    # Europa League
    "Nottingham Forest":            {"elo": 1740, "atk": 1.30, "def": 0.82},
}


async def main():
    updated_teams = 0
    async with AsyncSessionLocal() as session:
        # Update all teams we have stats for
        result = await session.execute(select(Team))
        teams = result.scalars().all()

        for team in teams:
            stats = TEAM_STATS.get(team.name)
            if stats:
                team.elo_rating = stats["elo"]
                team.attack_strength = stats["atk"]
                team.defense_weakness = stats["def"]
                updated_teams += 1

        await session.commit()

    print(f"✅ Updated {updated_teams} teams with real stats")

    # Regenerate all predictions with new stats
    engine = PredictionEngine()
    regen = 0

    async with AsyncSessionLocal() as session:
        # Load all scheduled matches with their predictions
        q = (
            select(Match)
            .options(
                selectinload(Match.league),
                selectinload(Match.home_team),
                selectinload(Match.away_team),
            )
            .where(Match.status == "SCHEDULED")
            .order_by(Match.match_date.asc())
        )
        result = await session.execute(q)
        matches = result.scalars().all()

        for match in matches:
            # Delete existing prediction if any
            r = await session.execute(
                select(Prediction).where(Prediction.match_id == match.id)
            )
            existing = r.scalar_one_or_none()
            if existing:
                await session.delete(existing)
                await session.flush()  # ensure delete hits DB before insert

            pred_data = await engine.predict(match)
            prediction = Prediction(match_id=match.id, **pred_data)
            session.add(prediction)
            regen += 1

        await session.commit()

    print(f"✅ Regenerated {regen} predictions with updated team stats")


if __name__ == "__main__":
    asyncio.run(main())
