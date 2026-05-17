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

        for match in matches:
            existing = await db.execute(select(Prediction).where(Prediction.match_id == match.id))
            if existing.scalar_one_or_none():
                continue
            try:
                # Base prediction (ELO + attack/defense stats)
                pred_data = await engine.predict(match)

                # Enrich with live features: form, injuries, H2H
                try:
                    import asyncio as _a
                    from app.ai.features import extract_features
                    from app.data_engine.pipeline import get_team_form, get_team_injuries, get_h2h
                    league_id = match.league.external_id or "ENG.1"
                    home_form, away_form, home_inj, away_inj, h2h = await _a.gather(
                        get_team_form(match.home_team.external_id or "", league_id, match.home_team.name),
                        get_team_form(match.away_team.external_id or "", league_id, match.away_team.name),
                        get_team_injuries(match.home_team.external_id or "", match.home_team.name, league_id),
                        get_team_injuries(match.away_team.external_id or "", match.away_team.name, league_id),
                        get_h2h(match.home_team.external_id or "", match.away_team.external_id or "", league_id, match.home_team.name, match.away_team.name),
                    )
                    features = extract_features(match=match, home_form=home_form, away_form=away_form,
                                                home_injuries=home_inj, away_injuries=away_inj, h2h=h2h)
                    rich = await engine.predict(match, features=features)
                    # Merge rich fields on top of base prediction
                    pred_data.update({k: rich[k] for k in (
                        "ai_summary", "tactical_notes", "key_factors",
                        "home_xg", "away_xg", "confidence_score", "risk_score",
                        "home_win_prob", "draw_prob", "away_win_prob",
                        "over_25_prob", "under_25_prob", "btts_yes_prob", "btts_no_prob",
                        "value_bet", "recommended_bet",
                    )})
                except Exception as feat_err:
                    logger.debug("features_unavailable", match_id=match.id, error=str(feat_err))

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


@celery_app.task(name="app.tasks.prediction_tasks.fetch_daily_matches")
def fetch_daily_matches():
    """Fetch today's and tomorrow's matches from ESPN into the database."""
    try:
        asyncio.run(_fetch_daily())
    except Exception as exc:
        logger.error("fetch_daily_matches_failed", error=str(exc))


async def _fetch_daily():
    from datetime import date, timedelta
    from app.data_engine.pipeline import ingest_date

    today = date.today()
    tomorrow = today + timedelta(days=1)
    for target_date in [today, tomorrow]:
        result = await ingest_date(target_date)
        logger.info("matches_ingested", date=str(target_date), result=str(result))


@celery_app.task(name="app.tasks.prediction_tasks.reconcile_finished_predictions")
def reconcile_finished_predictions():
    """Settle predictions for recently finished matches and update ROI."""
    try:
        asyncio.run(_reconcile())
    except Exception as exc:
        logger.error("reconcile_failed", error=str(exc))


async def _reconcile():
    from app.database import AsyncSessionLocal
    from app.services.backtest_service import BacktestService

    async with AsyncSessionLocal() as db:
        service = BacktestService(db)
        result = await service.reconcile_results()
        if result.get("updated", 0) > 0:
            logger.info("reconcile_completed", **result)
