from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from datetime import datetime, timezone, timedelta

from app.database import get_db
from app.models import Match, MatchStatus, Prediction, PredictionResult, Team, League
from app.schemas import AnalyticsOverview

router = APIRouter()


@router.get("/overview", response_model=AnalyticsOverview)
async def analytics_overview(db: AsyncSession = Depends(get_db)):
    from app.services.analytics_service import AnalyticsService
    service = AnalyticsService(db)
    return await service.get_overview()


@router.get("/leagues")
async def league_stats(db: AsyncSession = Depends(get_db)):
    from app.services.analytics_service import AnalyticsService
    service = AnalyticsService(db)
    return await service.get_league_stats()


@router.get("/team/{team_id}/form")
async def team_form(team_id: int, last_n: int = 10, db: AsyncSession = Depends(get_db)):
    from app.services.analytics_service import AnalyticsService
    service = AnalyticsService(db)
    return await service.get_team_form(team_id, last_n)


@router.get("/team/{team_id}/radar")
async def team_radar(team_id: int, db: AsyncSession = Depends(get_db)):
    from app.services.analytics_service import AnalyticsService
    service = AnalyticsService(db)
    return await service.get_team_radar(team_id)


@router.get("/comparison")
async def team_comparison(home_id: int, away_id: int, db: AsyncSession = Depends(get_db)):
    from app.services.analytics_service import AnalyticsService
    service = AnalyticsService(db)
    return await service.get_head_to_head(home_id, away_id)


@router.get("/alerts")
async def get_ai_alerts(db: AsyncSession = Depends(get_db)):
    """Real-time AI alerts: value bets, high confidence picks, injury warnings."""
    now = datetime.now(timezone.utc)
    window_start = now - timedelta(days=3)   # include recent finished matches too
    window_end = now + timedelta(days=7)

    # Predictions in window — upcoming scheduled OR recently settled
    q = (
        select(Prediction)
        .join(Prediction.match)
        .options(
            selectinload(Prediction.match).selectinload(Match.home_team),
            selectinload(Prediction.match).selectinload(Match.away_team),
            selectinload(Prediction.match).selectinload(Match.league),
        )
        .where(
            Match.match_date >= window_start,
            Match.match_date <= window_end,
        )
        .order_by(Prediction.confidence_score.desc())
        .limit(30)
    )
    result = await db.execute(q)
    preds = result.scalars().all()

    alerts = []
    for p in preds:
        m = p.match
        home = m.home_team.name
        away = m.away_team.name
        matchup = f"{home} vs {away}"

        # Value bet alert
        if p.value_bet and p.recommended_bet:
            bet_label = {
                "1": f"{home} win", "X": "Draw", "2": f"{away} win",
                "over_2.5": "Over 2.5 goals", "under_2.5": "Under 2.5 goals",
                "btts_yes": "BTTS Yes", "btts_no": "BTTS No",
            }.get(p.recommended_bet, p.recommended_bet)
            edge = max(p.home_win_prob, p.draw_prob, p.away_win_prob) * 100
            alerts.append({
                "id": f"value_{p.id}",
                "type": "value",
                "priority": "high",
                "title": "Value Bet Detected",
                "text": f"{matchup} — {bet_label} · AI edge {edge:.1f}%",
                "league": m.league.name,
                "match_date": m.match_date.isoformat(),
                "match_id": m.id,
                "prediction_id": p.id,
            })

        # High confidence alert (≥60)
        elif p.confidence_score and p.confidence_score >= 60:
            best_prob = max(p.home_win_prob, p.draw_prob, p.away_win_prob)
            if best_prob == p.home_win_prob:
                pick = f"{home} win"
            elif best_prob == p.away_win_prob:
                pick = f"{away} win"
            else:
                pick = "Draw"
            priority = "high" if p.confidence_score >= 70 else "medium"
            alerts.append({
                "id": f"confidence_{p.id}",
                "type": "model",
                "priority": priority,
                "title": "High Confidence Pick",
                "text": f"{matchup} — {pick} · {p.confidence_score:.1f}% confidence",
                "league": m.league.name,
                "match_date": m.match_date.isoformat(),
                "match_id": m.id,
                "prediction_id": p.id,
            })

    # Add FPL injury alerts for ENG.1 if available
    try:
        from app.data_engine.sources import fpl
        # Get teams playing in next 48h from ENG.1
        eng_teams = {
            m.match.home_team.name for m in preds if m.match.league.slug == "ENG.1"
        } | {
            m.match.away_team.name for m in preds if m.match.league.slug == "ENG.1"
        }
        for team_name in list(eng_teams)[:6]:
            injuries = await fpl.fetch_injuries(team_name)
            for inj in injuries[:2]:
                if inj.get("status") in ("Injured", "Doubtful"):
                    alerts.append({
                        "id": f"injury_{team_name}_{inj['web_name']}",
                        "type": "injury",
                        "priority": "medium",
                        "title": f"{inj['status']}: {inj['web_name']}",
                        "text": f"{inj['web_name']} ({team_name}) — {inj.get('news', 'Injury update')}",
                        "league": "Premier League",
                        "match_date": None,
                        "match_id": None,
                        "prediction_id": None,
                    })
    except Exception:
        pass

    # Sort: high priority first, then by date
    priority_order = {"high": 0, "medium": 1, "low": 2}
    alerts.sort(key=lambda a: (priority_order.get(a["priority"], 2), a.get("match_date") or ""))

    return alerts[:12]


@router.get("/daily-summary")
async def daily_summary(db: AsyncSession = Depends(get_db)):
    """Summary of today's predictions and backtest results."""
    from app.services.backtest_service import BacktestService
    from datetime import date

    today = date.today()
    svc = BacktestService(db)
    summary = await svc.compute_summary(date_from=today, date_to=today)

    # Count today's scheduled predictions
    now = datetime.now(timezone.utc)
    day_end = now.replace(hour=23, minute=59, second=59)
    day_start = now.replace(hour=0, minute=0, second=0)

    q = (
        select(func.count())
        .select_from(Prediction)
        .join(Match)
        .where(Match.match_date >= day_start, Match.match_date <= day_end)
    )
    res = await db.execute(q)
    today_predictions = res.scalar() or 0

    value_bets_q = (
        select(func.count())
        .select_from(Prediction)
        .join(Match)
        .where(Match.match_date >= day_start, Match.match_date <= day_end, Prediction.value_bet == True)
    )
    res2 = await db.execute(value_bets_q)
    today_value_bets = res2.scalar() or 0

    return {
        "today_predictions": today_predictions,
        "today_value_bets": today_value_bets,
        "settled_today": summary["total_predictions"],
        "accuracy_today": summary["accuracy"],
        "roi_today": summary["roi"],
        "profit_loss_today": summary["total_profit_loss"],
    }
