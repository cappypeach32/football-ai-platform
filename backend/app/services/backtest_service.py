from datetime import date
from collections import defaultdict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, case
from sqlalchemy.orm import selectinload
from app.models import Prediction, Match, League, PredictionResult, MatchStatus

# ── Constants ─────────────────────────────────────────────────────────────────
UNIT_STAKE = 1.0
DEFAULT_ODDS = 1.85  # fallback for markets without stored odds


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_odds(pred: Prediction, bet: str | None) -> float:
    if bet == "1":
        return pred.odds_home or DEFAULT_ODDS
    elif bet == "X":
        return pred.odds_draw or DEFAULT_ODDS
    elif bet == "2":
        return pred.odds_away or DEFAULT_ODDS
    return DEFAULT_ODDS


def _evaluate_bet(bet: str | None, home: int, away: int) -> bool | None:
    """Return True if the bet won, False if lost, None if unresolvable."""
    if bet is None:
        return None
    total = home + away
    if bet == "1":
        return home > away
    if bet == "X":
        return home == away
    if bet == "2":
        return home < away
    if bet == "over_2.5":
        return total > 2
    if bet == "under_2.5":
        return total <= 2
    if bet == "btts_yes":
        return home > 0 and away > 0
    if bet == "btts_no":
        return not (home > 0 and away > 0)
    return None


def _bet_prob(pred: Prediction, bet: str | None) -> float | None:
    if bet == "1":
        return pred.home_win_prob
    if bet == "X":
        return pred.draw_prob
    if bet == "2":
        return pred.away_win_prob
    if bet == "over_2.5":
        return pred.over_25_prob
    if bet == "under_2.5":
        return pred.under_25_prob
    if bet == "btts_yes":
        return pred.btts_yes_prob
    if bet == "btts_no":
        return pred.btts_no_prob
    return None


# ── Service ───────────────────────────────────────────────────────────────────

class BacktestService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ── Step 1: Reconciler ────────────────────────────────────────────────────

    async def reconcile_results(self) -> dict:
        """Find finished matches (with scores) and update pending predictions."""
        q = (
            select(Prediction)
            .join(Prediction.match)
            .where(
                Prediction.result == PredictionResult.PENDING,
                Match.home_score.is_not(None),
                Match.away_score.is_not(None),
            )
            .options(selectinload(Prediction.match))
        )
        result = await self.db.execute(q)
        preds = result.scalars().all()

        updated = wins = losses = 0
        for pred in preds:
            match = pred.match
            is_correct = _evaluate_bet(pred.recommended_bet, match.home_score, match.away_score)
            if is_correct is None:
                continue

            odds = _get_odds(pred, pred.recommended_bet)
            pred.is_correct = is_correct
            pred.profit_loss = round((odds - 1) * UNIT_STAKE if is_correct else -UNIT_STAKE, 4)
            pred.result = PredictionResult.WIN if is_correct else PredictionResult.LOSS

            # Ensure match marked finished
            match.status = MatchStatus.FINISHED

            updated += 1
            wins += int(is_correct)
            losses += int(not is_correct)

        await self.db.commit()
        return {"updated": updated, "wins": wins, "losses": losses}

    # ── Step 2+3: Summary with enhanced filters ───────────────────────────────

    async def compute_summary(
        self,
        league_id: int | None = None,
        min_confidence: float = 0.0,
        market: str | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        odds_min: float | None = None,
        odds_max: float | None = None,
    ) -> dict:
        q = (
            select(Prediction)
            .join(Prediction.match)
            .where(
                Prediction.result != PredictionResult.PENDING,
                Prediction.confidence_score >= min_confidence,
            )
            .options(selectinload(Prediction.match).selectinload(Match.league))
        )
        if league_id:
            q = q.where(Match.league_id == league_id)
        if market:
            q = q.where(Prediction.recommended_bet == market)
        if date_from:
            q = q.where(Match.match_date >= date_from)
        if date_to:
            q = q.where(Match.match_date <= date_to)

        # Filter by odds of the recommended bet
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

        result = await self.db.execute(q)
        preds = result.scalars().all()

        if not preds:
            return self._empty_summary()

        total = len(preds)
        correct = sum(1 for p in preds if p.is_correct)
        total_pl = sum(p.profit_loss or 0 for p in preds)
        roi = (total_pl / total) * 100 if total else 0
        avg_confidence = sum(p.confidence_score for p in preds) / total

        # By confidence tier
        tiers: dict[str, list[Prediction]] = {"high": [], "medium": [], "low": []}
        for p in preds:
            if p.confidence_score >= 75:
                tiers["high"].append(p)
            elif p.confidence_score >= 55:
                tiers["medium"].append(p)
            else:
                tiers["low"].append(p)

        by_confidence_tier = {
            tier: {
                "count": len(ps),
                "accuracy": round(sum(1 for p in ps if p.is_correct) / len(ps), 4),
                "roi": round(sum(p.profit_loss or 0 for p in ps) / len(ps) * 100, 2),
            }
            for tier, ps in tiers.items() if ps
        }

        # Monthly performance (Step 3)
        monthly: dict[str, list[Prediction]] = defaultdict(list)
        for p in preds:
            if p.match and p.match.match_date:
                monthly[p.match.match_date.strftime("%Y-%m")].append(p)

        monthly_performance = [
            {
                "month": month,
                "count": len(ps),
                "accuracy": round(sum(1 for p in ps if p.is_correct) / len(ps), 4),
                "roi": round(sum(p.profit_loss or 0 for p in ps) / len(ps) * 100, 2),
                "profit_loss": round(sum(p.profit_loss or 0 for p in ps), 2),
            }
            for month, ps in sorted(monthly.items())
        ]

        # By market
        by_market: dict[str, list[Prediction]] = defaultdict(list)
        for p in preds:
            by_market[p.recommended_bet or "unknown"].append(p)

        by_market_summary = {
            mkt: {
                "count": len(ps),
                "accuracy": round(sum(1 for p in ps if p.is_correct) / len(ps), 4),
                "roi": round(sum(p.profit_loss or 0 for p in ps) / len(ps) * 100, 2),
            }
            for mkt, ps in by_market.items()
        }

        # By league
        by_league: dict[str, list[Prediction]] = defaultdict(list)
        for p in preds:
            if p.match and p.match.league:
                by_league[p.match.league.name].append(p)

        by_league_summary = {
            lg: {
                "count": len(ps),
                "accuracy": round(sum(1 for p in ps if p.is_correct) / len(ps), 4),
                "roi": round(sum(p.profit_loss or 0 for p in ps) / len(ps) * 100, 2),
            }
            for lg, ps in by_league.items()
        }

        return {
            "total_predictions": total,
            "correct_predictions": correct,
            "accuracy": round(correct / total, 4),
            "roi": round(roi, 2),
            "total_profit_loss": round(total_pl, 2),
            "avg_confidence": round(avg_confidence, 1),
            "by_league": by_league_summary,
            "by_market": by_market_summary,
            "by_confidence_tier": by_confidence_tier,
            "monthly_performance": monthly_performance,
        }

    # ── Step 5: Confidence Calibration ────────────────────────────────────────

    async def get_calibration_data(self) -> list[dict]:
        """Bucket predictions by model probability and compute actual win rate."""
        q = (
            select(Prediction)
            .join(Prediction.match)
            .where(Prediction.result != PredictionResult.PENDING)
        )
        result = await self.db.execute(q)
        preds = result.scalars().all()

        buckets: dict[int, list[bool]] = defaultdict(list)
        for p in preds:
            prob = _bet_prob(p, p.recommended_bet)
            if prob is None:
                continue
            bucket = min(int(prob * 10) * 10, 90)  # 0–90 in steps of 10
            buckets[bucket].append(bool(p.is_correct))

        return [
            {
                "predicted_prob_pct": bucket,
                "actual_win_rate": round(sum(wins) / len(wins), 4),
                "count": len(wins),
            }
            for bucket, wins in sorted(buckets.items())
            if wins
        ]

    def _empty_summary(self) -> dict:
        return {
            "total_predictions": 0,
            "correct_predictions": 0,
            "accuracy": 0.0,
            "roi": 0.0,
            "total_profit_loss": 0.0,
            "avg_confidence": 0.0,
            "by_league": {},
            "by_market": {},
            "by_confidence_tier": {},
            "monthly_performance": [],
        }
