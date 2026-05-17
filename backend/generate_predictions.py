"""Generate AI predictions for all upcoming matches that don't yet have one."""
import asyncio
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.database import AsyncSessionLocal
from app.models import Match, Prediction, MatchStatus
from app.ai.engine import PredictionEngine
from app.data_engine.pipeline import (
    get_team_form,
    get_team_injuries,
    get_h2h,
    get_schedule_congestion,
)
from app.ai.features import extract_features
from app.ai.weather import get_match_weather


async def _fetch_features(match: Match, session):
    """Fetch all contextual features for a match in parallel where possible."""
    home_ext = match.home_team.external_id or ""
    away_ext = match.away_team.external_id or ""
    league_slug = (match.league.external_id or "ENG.1") if match.league else "ENG.1"

    home_form, away_form, home_inj, away_inj, h2h = await asyncio.gather(
        get_team_form(home_ext, league_slug),
        get_team_form(away_ext, league_slug),
        get_team_injuries(home_ext),
        get_team_injuries(away_ext),
        get_h2h(home_ext, away_ext, league_slug),
    )

    home_rest, away_rest = (
        await get_schedule_congestion(home_ext, session),
        await get_schedule_congestion(away_ext, session),
    )

    venue   = getattr(match, "venue", None)
    country = match.league.country if match.league else None
    weather = await get_match_weather(venue, country, match.match_date)

    return extract_features(
        match, home_form, away_form, home_inj, away_inj, h2h,
        home_days_rest=home_rest,
        away_days_rest=away_rest,
        weather=weather,
    )


async def main():
    engine = PredictionEngine()

    async with AsyncSessionLocal() as session:
        # Find all scheduled matches without a prediction
        q = (
            select(Match)
            .outerjoin(Prediction, Prediction.match_id == Match.id)
            .options(
                selectinload(Match.league),
                selectinload(Match.home_team),
                selectinload(Match.away_team),
            )
            .where(
                Match.status == MatchStatus.SCHEDULED,
                Prediction.id == None,  # no prediction yet
            )
            .order_by(Match.match_date.asc())
        )
        result = await session.execute(q)
        matches = result.scalars().all()

    print(f"Found {len(matches)} matches needing predictions\n")

    generated = 0
    failed = 0
    async with AsyncSessionLocal() as session:
        for match in matches:
            try:
                features  = await _fetch_features(match, session)
                pred_data = await engine.predict(match, features)
                pred_data.pop("top_scores", None)
                prediction = Prediction(match_id=match.id, **pred_data)
                session.add(prediction)
                xgb_tag = " [XGB]" if features else ""
                print(f"  ✅ {match.home_team.name} vs {match.away_team.name} "
                      f"({match.match_date.strftime('%d %b')}) — "
                      f"conf: {pred_data['confidence_score']:.0f}%"
                      f"{xgb_tag}"
                      f"{' [VALUE]' if pred_data['value_bet'] else ''}")
                generated += 1
            except Exception as e:
                print(f"  ❌ {match.home_team.name} vs {match.away_team.name}: {e}")
                failed += 1

        await session.commit()

    print(f"\n✅ Done — {generated} predictions generated, {failed} failed.")


if __name__ == "__main__":
    asyncio.run(main())
