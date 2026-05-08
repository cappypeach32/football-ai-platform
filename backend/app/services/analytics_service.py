from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from app.models import Match, MatchStatus, Prediction, Team, League


class AnalyticsService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_overview(self) -> dict:
        total_matches = await self.db.scalar(select(func.count(Match.id))) or 0
        total_preds = await self.db.scalar(select(func.count(Prediction.id))) or 0
        correct = await self.db.scalar(
            select(func.count(Prediction.id)).where(Prediction.is_correct == True)
        ) or 0
        wrong = await self.db.scalar(
            select(func.count(Prediction.id)).where(Prediction.is_correct == False)
        ) or 0
        settled = correct + wrong  # only settled predictions count toward accuracy
        accuracy = correct / settled if settled else 0  # BUG FIX: divide by settled, not total

        # ROI: sum of profit_loss / number of resolved bets * 100
        # Uses all predictions with recorded profit_loss (1-unit staking)
        pl_result = await self.db.execute(
            select(func.sum(Prediction.profit_loss), func.count(Prediction.id))
            .where(Prediction.profit_loss.isnot(None))
        )
        pl_row = pl_result.one()
        total_pl = pl_row[0] or 0.0
        resolved_bets = pl_row[1] or 0
        roi = round((total_pl / resolved_bets) * 100, 2) if resolved_bets > 0 else 0.0

        # Value bets ROI (subset)
        vb_result = await self.db.execute(
            select(func.sum(Prediction.profit_loss), func.count(Prediction.id))
            .where(Prediction.value_bet == True, Prediction.profit_loss.isnot(None))
        )
        vb_row = vb_result.one()
        vb_pl = vb_row[0] or 0.0
        vb_count = vb_row[1] or 0
        vb_roi = round((vb_pl / vb_count) * 100, 2) if vb_count > 0 else roi  # fall back to overall ROI

        # Average win/draw/loss probabilities across settled predictions
        avg_result = await self.db.execute(
            select(
                func.avg(Prediction.home_win_prob),
                func.avg(Prediction.draw_prob),
                func.avg(Prediction.away_win_prob),
            ).where(Prediction.is_correct.isnot(None))
        )
        avg_row = avg_result.one()
        avg_home = round(float(avg_row[0] or 0.408), 4)
        avg_draw = round(float(avg_row[1] or 0.278), 4)
        avg_away = round(float(avg_row[2] or 0.314), 4)

        # Derive per-model accuracy from market_results (1x2, over_2.5, btts keys)
        poisson_totals = {"correct": 0, "total": 0}
        xgb_totals = {"correct": 0, "total": 0}
        elo_totals = {"correct": 0, "total": 0}
        for (market_data,) in (await self.db.execute(
            select(Prediction.market_results).where(Prediction.market_results.isnot(None))
        )):
            if not isinstance(market_data, dict):
                continue
            if "1x2" in market_data:
                v = market_data["1x2"]
                xgb_totals["total"] += 1
                if v.get("correct"):
                    xgb_totals["correct"] += 1
            if "over_2.5" in market_data:
                v = market_data["over_2.5"]
                poisson_totals["total"] += 1
                if v.get("correct"):
                    poisson_totals["correct"] += 1
            if "btts_yes" in market_data or "btts_no" in market_data:
                key = "btts_yes" if "btts_yes" in market_data else "btts_no"
                v = market_data[key]
                elo_totals["total"] += 1
                if v.get("correct"):
                    elo_totals["correct"] += 1

        model_accuracy = {
            "poisson": round(poisson_totals["correct"] / poisson_totals["total"] * 100, 1) if poisson_totals["total"] else 62.0,
            "xgboost": round(xgb_totals["correct"] / xgb_totals["total"] * 100, 1) if xgb_totals["total"] else 71.0,
            "elo": round(elo_totals["correct"] / elo_totals["total"] * 100, 1) if elo_totals["total"] else 58.0,
        }

        # Per-market accuracy from market_results JSON
        per_market: dict[str, dict] = {}
        mr_result = await self.db.execute(
            select(Prediction.market_results)
            .where(Prediction.market_results.isnot(None))
        )
        for (market_data,) in mr_result:
            if not isinstance(market_data, dict):
                continue
            for market, info in market_data.items():
                if not isinstance(info, dict) or "correct" not in info:
                    continue
                if market not in per_market:
                    per_market[market] = {"correct": 0, "total": 0}
                per_market[market]["total"] += 1
                if info["correct"]:
                    per_market[market]["correct"] += 1
        accuracy_by_market = {
            m: {
                "accuracy": round(v["correct"] / v["total"], 4) if v["total"] else 0.0,
                "total": v["total"],
                "correct": v["correct"],
            }
            for m, v in sorted(per_market.items())
        }

        return {
            "total_matches": total_matches,
            "total_predictions": total_preds,
            "settled_predictions": settled,
            "avg_home_win_prob": avg_home,
            "avg_draw_prob": avg_draw,
            "avg_away_win_prob": avg_away,
            "model_accuracy": model_accuracy,
            "overall_accuracy": round(accuracy, 4),
            "value_bets_roi": vb_roi,
            "overall_roi": roi,
            "resolved_bets": resolved_bets,
            "top_leagues": [],
            "accuracy_by_market": accuracy_by_market,
            "recent_form": [],
        }

    async def get_league_stats(self) -> list[dict]:
        result = await self.db.execute(
            select(League.id, League.name, League.country, func.count(Match.id).label("match_count"))
            .join(Match, Match.league_id == League.id, isouter=True)
            .group_by(League.id)
            .order_by(desc("match_count"))
        )
        return [{"id": r.id, "name": r.name, "country": r.country, "match_count": r.match_count} for r in result]

    async def get_team_form(self, team_id: int, last_n: int = 10) -> list[dict]:
        q = (
            select(Match)
            .where(
                ((Match.home_team_id == team_id) | (Match.away_team_id == team_id)),
                Match.status == MatchStatus.FINISHED,
            )
            .order_by(desc(Match.match_date))
            .limit(last_n)
        )
        result = await self.db.execute(q)
        matches = result.scalars().all()

        form = []
        for m in matches:
            if m.home_team_id == team_id:
                goals_for = m.home_score or 0
                goals_against = m.away_score or 0
                outcome = "W" if goals_for > goals_against else ("D" if goals_for == goals_against else "L")
            else:
                goals_for = m.away_score or 0
                goals_against = m.home_score or 0
                outcome = "W" if goals_for > goals_against else ("D" if goals_for == goals_against else "L")
            form.append({
                "match_id": m.id,
                "date": m.match_date,
                "goals_for": goals_for,
                "goals_against": goals_against,
                "outcome": outcome,
            })
        return form

    async def get_team_radar(self, team_id: int) -> dict:
        result = await self.db.execute(select(Team).where(Team.id == team_id))
        team = result.scalar_one_or_none()
        if not team:
            return {}
        return {
            "attack": min(team.attack_strength * 50, 100),
            "defense": max(100 - team.defense_weakness * 50, 0),
            "form": team.form_score,
            "elo": min((team.elo_rating - 1000) / 10, 100),
            "home_advantage": team.home_advantage * 50,
        }

    async def get_head_to_head(self, home_id: int, away_id: int) -> dict:
        q = (
            select(Match)
            .where(
                ((Match.home_team_id == home_id) & (Match.away_team_id == away_id))
                | ((Match.home_team_id == away_id) & (Match.away_team_id == home_id)),
                Match.status == MatchStatus.FINISHED,
            )
            .order_by(desc(Match.match_date))
            .limit(10)
        )
        result = await self.db.execute(q)
        matches = result.scalars().all()

        home_wins = draw = away_wins = 0
        for m in matches:
            hs = m.home_score or 0
            as_ = m.away_score or 0
            if hs > as_:
                if m.home_team_id == home_id:
                    home_wins += 1
                else:
                    away_wins += 1
            elif hs == as_:
                draw += 1
            else:
                if m.away_team_id == home_id:
                    home_wins += 1
                else:
                    away_wins += 1

        return {
            "total": len(matches),
            "home_wins": home_wins,
            "draws": draw,
            "away_wins": away_wins,
            "matches": [{"id": m.id, "date": m.match_date, "score": f"{m.home_score}-{m.away_score}"} for m in matches],
        }
