"""
One-shot script to back-fill market_results JSON for all predictions that
already have a final result (home_score + away_score available) but whose
market_results column is NULL.

Run:
    cd /Users/tomaszdravkov/football-ai-platform/backend
    source .venv/bin/activate
    python scripts/backfill_market_results.py
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import AsyncSessionLocal as async_session_factory
from app.models import Prediction, PredictionResult


_ALL_MARKETS = [
    "1", "X", "2",
    "dc_1x", "dc_12", "dc_x2",
    "over_1.5", "under_1.5",
    "over_2.5", "under_2.5",
    "over_3.5", "under_3.5",
    "btts_yes", "btts_no",
]


def _evaluate(bet: str, home: int, away: int) -> bool | None:
    total = home + away
    if bet == "1":      return home > away
    if bet == "X":      return home == away
    if bet == "2":      return home < away
    if bet == "over_2.5":   return total > 2
    if bet == "under_2.5":  return total <= 2
    if bet == "over_1.5":   return total > 1
    if bet == "under_1.5":  return total <= 1
    if bet == "over_3.5":   return total > 3
    if bet == "under_3.5":  return total <= 3
    if bet == "btts_yes":   return home > 0 and away > 0
    if bet == "btts_no":    return not (home > 0 and away > 0)
    if bet == "dc_1x":  return home >= away
    if bet == "dc_12":  return home != away
    if bet == "dc_x2":  return away >= home
    return None


def _prob(pred: Prediction, bet: str) -> float | None:
    mapping = {
        "1":          pred.home_win_prob,
        "X":          pred.draw_prob,
        "2":          pred.away_win_prob,
        "over_2.5":   pred.over_25_prob,
        "under_2.5":  pred.under_25_prob,
        "over_1.5":   getattr(pred, "over_15_prob", None),
        "under_1.5":  getattr(pred, "under_15_prob", None),
        "over_3.5":   getattr(pred, "over_35_prob", None),
        "under_3.5":  getattr(pred, "under_35_prob", None),
        "btts_yes":   pred.btts_yes_prob,
        "btts_no":    pred.btts_no_prob,
        "dc_1x":      getattr(pred, "dc_1x_prob", None),
        "dc_12":      getattr(pred, "dc_12_prob", None),
        "dc_x2":      getattr(pred, "dc_x2_prob", None),
    }
    return mapping.get(bet)


async def backfill():
    async with async_session_factory() as session:
        result = await session.execute(
            select(Prediction)
            .where(
                Prediction.result != PredictionResult.PENDING,
                Prediction.market_results.is_(None),
            )
            .options(selectinload(Prediction.match))
        )
        preds = result.scalars().all()
        print(f"Found {len(preds)} predictions to backfill")

        updated = 0
        for pred in preds:
            match = pred.match
            if match is None or match.home_score is None or match.away_score is None:
                continue
            market_results: dict = {}
            for market in _ALL_MARKETS:
                correct = _evaluate(market, match.home_score, match.away_score)
                prob = _prob(pred, market)
                if correct is not None and prob is not None:
                    market_results[market] = {"correct": correct, "prob": round(prob, 4)}
            pred.market_results = market_results
            updated += 1

        await session.commit()
        print(f"Backfilled {updated} predictions with market_results")


if __name__ == "__main__":
    asyncio.run(backfill())
