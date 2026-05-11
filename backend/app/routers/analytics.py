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


@router.get("/leagues/{external_id}/intelligence")
async def league_intelligence(external_id: str, db: AsyncSession = Depends(get_db)):
    """
    Returns pre-computed league intelligence stats derived from historical CSV data.
    Also includes qualitative insights.
    """
    result = await db.execute(
        sa.select(League).where(func.lower(League.external_id) == external_id.lower())
    )
    league = result.scalar_one_or_none()
    if league is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=f"League '{external_id}' not found")

    avg = league.avg_goals_per_game
    draw = league.draw_rate
    btts = league.btts_rate
    hw   = league.home_win_rate
    var  = league.goals_variance

    # Qualitative insights
    insights = []
    if avg >= 3.0:
        insights.append({"icon": "⚽", "text": f"High-scoring league: {avg:.2f} goals/game on average", "type": "positive"})
    elif avg <= 2.3:
        insights.append({"icon": "🔒", "text": f"Low-scoring league: {avg:.2f} goals/game — under bets favoured", "type": "warning"})

    if draw >= 0.28:
        insights.append({"icon": "⚖️", "text": f"Draw-heavy: {draw*100:.1f}% of games end level — draw value plays exist", "type": "info"})
    elif draw <= 0.22:
        insights.append({"icon": "🎯", "text": f"Low draw rate ({draw*100:.1f}%) — back decisive outcomes", "type": "info"})

    if btts >= 0.58:
        insights.append({"icon": "🔥", "text": f"BTTS lands {btts*100:.1f}% of games — high BTTS value", "type": "positive"})

    if hw >= 0.48:
        insights.append({"icon": "🏠", "text": f"Strong home advantage: {hw*100:.1f}% home wins historically", "type": "positive"})

    if var >= 3.0:
        insights.append({"icon": "📊", "text": "High goal variance — expect unpredictable scorelines", "type": "warning"})

    return {
        "league_id": league.id,
        "external_id": league.external_id,
        "name": league.name,
        "country": league.country,
        "seasons_computed": league.seasons_computed,
        "stats": {
            "avg_goals_per_game": avg,
            "draw_rate": draw,
            "btts_rate": btts,
            "goals_variance": var,
            "home_win_rate": hw,
            "away_win_rate": round(1 - hw - draw, 4),
        },
        "insights": insights,
    }


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


@router.get("/daily-report")
async def daily_report(db: AsyncSession = Depends(get_db)):
    """
    Rich AI daily briefing:
    - top 3 highest-confidence picks today
    - strongest value bet (highest expected value proxy)
    - high-variance warnings (risk_score >= 60)
    - quick headline stats
    """
    now = datetime.now(timezone.utc)
    day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    day_end   = now.replace(hour=23, minute=59, second=59, microsecond=999999)

    base_q = (
        select(Prediction)
        .join(Match)
        .options(selectinload(Prediction.match).selectinload(Match.home_team),
                 selectinload(Prediction.match).selectinload(Match.away_team),
                 selectinload(Prediction.match).selectinload(Match.league))
        .where(Match.match_date >= day_start, Match.match_date <= day_end)
    )
    result = await db.execute(base_q)
    preds = result.scalars().all()

    def _bet_label(p: Prediction) -> str:
        bet_map = {"1": p.match.home_team.name, "X": "Draw", "2": p.match.away_team.name}
        return bet_map.get(str(p.recommended_bet), str(p.recommended_bet or "—"))

    def _pick_odds(p: Prediction) -> float | None:
        bet_map = {"1": p.odds_home, "X": p.odds_draw, "2": p.odds_away}
        return bet_map.get(str(p.recommended_bet))

    def _ev(p: Prediction) -> float | None:
        prob_map = {"1": p.home_win_prob, "X": p.draw_prob, "2": p.away_win_prob}
        prob = prob_map.get(str(p.recommended_bet))
        odds = _pick_odds(p)
        if prob is None or odds is None:
            return None
        return round((prob * odds - 1) * 100, 1)

    def _risk_category(p: Prediction) -> str:
        conf, risk = p.confidence_score, p.risk_score
        probs = sorted([p.home_win_prob, p.draw_prob, p.away_win_prob], reverse=True)
        spread = probs[0] - probs[1]
        if risk >= 60 or spread < 0.12:
            return "High Variance"
        if conf >= 62 and risk < 45 and (p.model_agreement or 0) >= 2:
            return "Safe"
        if conf >= 50 and risk < 55:
            return "Balanced"
        return "Aggressive"

    def _pred_summary(p: Prediction) -> dict:
        return {
            "id": p.id,
            "home": p.match.home_team.name,
            "away": p.match.away_team.name,
            "league": p.match.league.name,
            "match_date": p.match.match_date.isoformat(),
            "pick": _bet_label(p),
            "odds": _pick_odds(p),
            "confidence": round(p.confidence_score, 1),
            "risk": round(p.risk_score, 1),
            "risk_category": _risk_category(p),
            "ev": _ev(p),
            "model_agreement": p.model_agreement,
            "value_bet": p.value_bet,
        }

    # Top-3 confidence picks
    top_picks = sorted(preds, key=lambda x: x.confidence_score, reverse=True)[:3]

    # Strongest value bet (highest positive EV)
    value_preds = [p for p in preds if p.value_bet]
    strongest_value = None
    if value_preds:
        best = max(value_preds, key=lambda x: (_ev(x) or -999))
        strongest_value = _pred_summary(best)

    # High-variance warnings
    high_variance = [_pred_summary(p) for p in preds
                     if p.risk_score >= 60 or _risk_category(p) == "High Variance"]
    high_variance.sort(key=lambda x: x["risk"], reverse=True)

    # Headline stats
    all_evs = [_ev(p) for p in preds if _ev(p) is not None]
    avg_ev = round(sum(all_evs) / len(all_evs), 1) if all_evs else None
    model_agreement_full = sum(1 for p in preds if (p.model_agreement or 0) >= 3)

    return {
        "generated_at": now.isoformat(),
        "total_predictions": len(preds),
        "value_bets_count": len(value_preds),
        "high_variance_count": len(high_variance),
        "model_full_agreement_count": model_agreement_full,
        "avg_expected_value": avg_ev,
        "top_confidence_picks": [_pred_summary(p) for p in top_picks],
        "strongest_value_bet": strongest_value,
        "high_variance_warnings": high_variance[:5],
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
