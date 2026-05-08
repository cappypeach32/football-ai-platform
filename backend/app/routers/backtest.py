from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload
from datetime import date

from app.database import get_db
from app.models import Prediction, Match, League, PredictionResult
from app.schemas import BacktestSummary
from app.dependencies import get_current_user, require_premium
from app.models import User

router = APIRouter()


@router.post("/reconcile")
async def reconcile_backtest(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Evaluate pending predictions for finished matches and update win/loss/profit."""
    from app.services.backtest_service import BacktestService
    service = BacktestService(db)
    return await service.reconcile_results()


@router.get("/summary", response_model=BacktestSummary)
async def backtest_summary(
    league_id: int | None = Query(None),
    min_confidence: float = Query(0.0, ge=0, le=100),
    market: str | None = Query(None, description="e.g. 1, X, 2, over_2.5, btts_yes"),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    odds_min: float | None = Query(None, ge=1.0),
    odds_max: float | None = Query(None, ge=1.0),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    from app.services.backtest_service import BacktestService
    service = BacktestService(db)
    return await service.compute_summary(
        league_id=league_id,
        min_confidence=min_confidence,
        market=market,
        date_from=date_from,
        date_to=date_to,
        odds_min=odds_min,
        odds_max=odds_max,
    )


@router.get("/calibration")
async def calibration_data(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Confidence calibration: predicted probability vs actual win rate per bucket."""
    from app.services.backtest_service import BacktestService
    service = BacktestService(db)
    return await service.get_calibration_data()


@router.get("/predictions", response_model=list)
async def historical_predictions(
    league_id: int | None = Query(None),
    result: str | None = Query(None),
    market: str | None = Query(None),
    min_confidence: float = Query(0.0, ge=0, le=100),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    odds_min: float | None = Query(None, ge=1.0),
    odds_max: float | None = Query(None, ge=1.0),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    from sqlalchemy import case
    q = (
        select(Prediction)
        .join(Prediction.match)
        .options(
            selectinload(Prediction.match).selectinload(Match.league),
            selectinload(Prediction.match).selectinload(Match.home_team),
            selectinload(Prediction.match).selectinload(Match.away_team),
        )
        .where(
            Prediction.result != PredictionResult.PENDING,
            Prediction.confidence_score >= min_confidence,
        )
        .order_by(desc(Match.match_date))
        .limit(limit)
        .offset(offset)
    )
    if league_id:
        q = q.where(Match.league_id == league_id)
    if result:
        q = q.where(Prediction.result == PredictionResult(result))
    if market:
        q = q.where(Prediction.recommended_bet == market)
    if date_from:
        q = q.where(Match.match_date >= date_from)
    if date_to:
        q = q.where(Match.match_date <= date_to)
    if odds_min is not None or odds_max is not None:
        resolved_odds = case(
            (Prediction.recommended_bet == "1", Prediction.odds_home),
            (Prediction.recommended_bet == "X", Prediction.odds_draw),
            (Prediction.recommended_bet == "2", Prediction.odds_away),
            else_=None,
        )
        if odds_min is not None:
            q = q.where(resolved_odds >= odds_min)
        if odds_max is not None:
            q = q.where(resolved_odds <= odds_max)

    res = await db.execute(q)
    return res.scalars().all()
