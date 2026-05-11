from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from datetime import datetime, timezone, timedelta, date

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
async def get_ai_alerts(
    from_date: date | None = Query(None, description="Local calendar date floor (YYYY-MM-DD)"),
    db: AsyncSession = Depends(get_db),
):
    """Real-time AI alerts: value bets, high confidence picks, injury warnings."""
    now = datetime.now(timezone.utc)
    # Floor: start of the user's local calendar day (passed from browser).
    # Falls back to start of today UTC so past-day matches never bleed through.
    if from_date:
        from datetime import time as dtime
        day_floor = datetime(from_date.year, from_date.month, from_date.day, 0, 0, 0, tzinfo=timezone.utc)
    else:
        day_floor = now.replace(hour=0, minute=0, second=0, microsecond=0)
    # Keep a 3-hour lookback for in-play matches only (not 3 days)
    in_play_cutoff = now - timedelta(hours=3)
    window_start = max(in_play_cutoff, day_floor)
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


# ---------------------------------------------------------------------------
# Live Intelligence Feed
# ---------------------------------------------------------------------------

_INTEL_LEAGUES = [
    ("eng.1",                 "Premier League"),
    ("esp.1",                 "La Liga"),
    ("ger.1",                 "Bundesliga"),
    ("ita.1",                 "Serie A"),
    ("fra.1",                 "Ligue 1"),
    ("uefa.champions_league", "Champions League"),
    ("UEFA.EUROPA",           "Europa League"),
    ("UEFA.EUROPA.CONF",      "Conference League"),
]


def _us_to_dec(s: str | None) -> float | None:
    """Convert American odds string (e.g. '+235', '-130') to decimal odds."""
    try:
        v = int(str(s).replace(" ", ""))
        return round((v / 100 + 1) if v > 0 else (100 / abs(v) + 1), 4)
    except Exception:
        return None


def _implied_prob(dec: float | None) -> float | None:
    return round(100.0 / dec, 1) if dec and dec > 1.0 else None


@router.get("/intelligence")
async def get_intelligence_signals(
    from_date: date | None = Query(None),
):
    """
    Live Intelligence Feed: real-time signals derived from ESPN odds movement
    (open vs close) and FPL injury data.  No paid API required.
    """
    import aiohttp
    import asyncio
    import certifi
    import ssl as _ssl

    ssl_ctx = _ssl.create_default_context(cafile=certifi.where())

    async def fetch_league(sess: aiohttp.ClientSession, slug: str):
        url = f"https://site.api.espn.com/apis/site/v2/sports/soccer/{slug}/scoreboard"
        try:
            async with sess.get(url, ssl=ssl_ctx,
                                timeout=aiohttp.ClientTimeout(total=8)) as resp:
                if resp.status != 200:
                    return slug, []
                data = await resp.json(content_type=None)
                return slug, data.get("events", [])
        except Exception:
            return slug, []

    signals: list[dict] = []
    pl_teams_today: list[str] = []

    async with aiohttp.ClientSession() as sess:
        results = await asyncio.gather(
            *[fetch_league(sess, slug) for slug, _ in _INTEL_LEAGUES]
        )

    league_name_map = {slug: name for slug, name in _INTEL_LEAGUES}

    for (slug, _), (_, events) in zip(_INTEL_LEAGUES, results):
        league_name = league_name_map[slug]
        for event in events:
            comps = event.get("competitions", [])
            if not comps:
                continue
            comp = comps[0]
            competitors = comp.get("competitors", [])
            home = next(
                (c["team"].get("displayName", "Home")
                 for c in competitors if c.get("homeAway") == "home"), "Home"
            )
            away = next(
                (c["team"].get("displayName", "Away")
                 for c in competitors if c.get("homeAway") == "away"), "Away"
            )
            match_name = f"{home} vs {away}"
            start_iso = comp.get("startDate", "")

            if slug == "eng.1":
                pl_teams_today.extend([home, away])

            odds_list = comp.get("odds", [])
            if not odds_list:
                continue
            odds = odds_list[0]
            if not odds:
                continue

            # --- 1X2 moneyline movement ---
            ml = odds.get("moneyline", {})
            for side, team in [("home", home), ("away", away)]:
                ml_s = ml.get(side, {})
                open_dec  = _us_to_dec(ml_s.get("open",  {}).get("odds"))
                close_dec = _us_to_dec(ml_s.get("close", {}).get("odds"))
                if not open_dec or not close_dec:
                    continue
                op = _implied_prob(open_dec)
                cp = _implied_prob(close_dec)
                if op is None or cp is None:
                    continue
                delta = round(cp - op, 1)
                if abs(delta) < 5.0:
                    continue
                o_str = ml_s.get("open",  {}).get("odds", "?")
                c_str = ml_s.get("close", {}).get("odds", "?")
                signals.append({
                    "id": f"odds_{event['id']}_{side}",
                    "type": "odds_movement",
                    "priority": "high" if abs(delta) >= 10 else "medium",
                    "match": match_name,
                    "league": league_name,
                    "title": f"Sharp money on {team}",
                    "detail": f"Odds {o_str} → {c_str} · prob {'+' if delta > 0 else ''}{delta:.1f}%",
                    "prob_delta": delta,
                    "match_time": start_iso,
                })

            # --- Over/Under totals movement ---
            total = odds.get("total", {})
            over_open_dec  = _us_to_dec(total.get("over", {}).get("open",  {}).get("odds"))
            over_close_dec = _us_to_dec(total.get("over", {}).get("close", {}).get("odds"))
            if over_open_dec and over_close_dec:
                op = _implied_prob(over_open_dec)
                cp = _implied_prob(over_close_dec)
                if op and cp:
                    delta = round(cp - op, 1)
                    if abs(delta) >= 5.0:
                        direction = "Over 2.5" if delta > 0 else "Under 2.5"
                        o_str = total.get("over", {}).get("open",  {}).get("odds", "?")
                        c_str = total.get("over", {}).get("close", {}).get("odds", "?")
                        signals.append({
                            "id": f"goals_{event['id']}",
                            "type": "goals_signal",
                            "priority": "medium",
                            "match": match_name,
                            "league": league_name,
                            "title": f"Goals market: {direction} favoured",
                            "detail": f"Over 2.5 {o_str} → {c_str} · prob {'+' if delta > 0 else ''}{delta:.1f}%",
                            "prob_delta": delta,
                            "match_time": start_iso,
                        })

    # --- FPL injury signals for PL teams playing today ---
    try:
        from app.data_engine.sources import fpl as _fpl
        seen: set[str] = set()
        for team_name in list(set(pl_teams_today))[:8]:
            injuries = await _fpl.fetch_injuries(team_name)
            for inj in injuries[:3]:
                if inj.get("status") not in ("Injured", "Doubtful"):
                    continue
                key = inj.get("web_name", "")
                if key in seen:
                    continue
                seen.add(key)
                cost = (inj.get("now_cost") or 0) / 10.0
                impact = -8 if cost >= 10.0 else (-5 if cost >= 8.0 else -3)
                signals.append({
                    "id": f"injury_{team_name}_{key}",
                    "type": "injury",
                    "priority": "high" if cost >= 10.0 else "medium",
                    "match": f"{team_name} — today",
                    "league": "Premier League",
                    "title": f"{key} {inj['status'].lower()} ({team_name})",
                    "detail": f"Win probability impact est. {impact}%",
                    "prob_delta": impact,
                    "match_time": None,
                })
    except Exception:
        pass

    # Sort: high priority first, then by magnitude of signal
    signals.sort(key=lambda s: (
        0 if s["priority"] == "high" else 1,
        -abs(s.get("prob_delta", 0))
    ))

    return signals[:15]
