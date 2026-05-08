import asyncio
import structlog
from app.tasks.celery_app import celery_app

logger = structlog.get_logger()


@celery_app.task(name="app.tasks.prediction_tasks.refresh_upcoming_predictions", bind=True, max_retries=3)
def refresh_upcoming_predictions(self):
    """Generate/update predictions for all upcoming matches in the next 48 hours."""
    try:
        asyncio.run(_refresh_predictions())
    except Exception as exc:
        logger.error("refresh_predictions_failed", error=str(exc))
        raise self.retry(exc=exc, countdown=300)


async def _refresh_predictions():
    from datetime import datetime, timedelta, timezone
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    from app.database import AsyncSessionLocal
    from app.models import Match, MatchStatus, Prediction
    from app.ai.engine import PredictionEngine

    engine = PredictionEngine()
    async with AsyncSessionLocal() as db:
        now = datetime.now(timezone.utc)
        cutoff = now + timedelta(hours=48)
        q = (
            select(Match)
            .options(
                selectinload(Match.home_team),
                selectinload(Match.away_team),
                selectinload(Match.league),
            )
            .where(Match.match_date >= now, Match.match_date <= cutoff, Match.status == MatchStatus.SCHEDULED)
        )
        result = await db.execute(q)
        matches = result.scalars().all()
        logger.info("refreshing_predictions", count=len(matches))

        for match in matches:
            existing = await db.execute(select(Prediction).where(Prediction.match_id == match.id))
            if existing.scalar_one_or_none():
                continue
            try:
                pred_data = await engine.predict(match)
                _PRED_FIELDS = {
                    "home_win_prob", "draw_prob", "away_win_prob",
                    "over_25_prob", "under_25_prob",
                    "over_15_prob", "under_15_prob",
                    "over_35_prob", "under_35_prob",
                    "btts_yes_prob", "btts_no_prob",
                    "dc_1x_prob", "dc_12_prob", "dc_x2_prob",
                    "home_xg", "away_xg", "confidence_score",
                    "risk_score", "value_bet", "recommended_bet", "ai_summary", "tactical_notes",
                    "key_factors", "odds_home", "odds_draw", "odds_away", "model_version",
                }
                filtered = {k: v for k, v in pred_data.items() if k in _PRED_FIELDS}
                pred = Prediction(match_id=match.id, **filtered)
                db.add(pred)
            except Exception as e:
                logger.warning("prediction_failed", match_id=match.id, error=str(e))

        await db.commit()
        logger.info("predictions_refreshed")


@celery_app.task(name="app.tasks.prediction_tasks.update_live_matches")
def update_live_matches():
    asyncio.run(_update_live())


async def _update_live():
    from app.database import AsyncSessionLocal
    from app.models import Match, MatchStatus
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    from app.websockets.manager import ws_manager

    async with AsyncSessionLocal() as db:
        q = select(Match).where(Match.status == MatchStatus.LIVE).options(
            selectinload(Match.home_team), selectinload(Match.away_team)
        )
        result = await db.execute(q)
        live_matches = result.scalars().all()

        for match in live_matches:
            state = {
                "type": "live_update",
                "match_id": match.id,
                "minute": match.minute,
                "home_score": match.home_score or 0,
                "away_score": match.away_score or 0,
                "stats": match.stats or {},
            }
            await ws_manager.broadcast(match.id, state)
