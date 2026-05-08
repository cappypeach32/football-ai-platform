"""Admin router — user management, prediction overrides, platform analytics."""
from datetime import date, timedelta, datetime, timezone
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, or_
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from typing import Literal
from app.database import get_db
from app.dependencies import get_current_user, require_admin
from app.models import (
    User, UserRole, Subscription, SubscriptionPlan, SubscriptionStatus,
    Match, MatchStatus, Prediction, PredictionResult, League,
)

router = APIRouter()

# ── Schemas ───────────────────────────────────────────────────────────────────

class SetSubscriptionBody(BaseModel):
    plan: Literal["free", "premium", "vip"]
    status: Literal["active", "cancelled", "expired", "trial"] = "active"

class SetRoleBody(BaseModel):
    role: Literal["user", "admin", "moderator"]

class PredictionOverrideBody(BaseModel):
    confidence_score: float | None = None
    recommended_bet: str | None = None
    value_bet: bool | None = None
    ai_summary: str | None = None

# ── Helper ────────────────────────────────────────────────────────────────────

def _user_dict(u: User) -> dict:
    sub = u.subscription
    return {
        "id": str(u.id),
        "email": u.email,
        "username": u.username,
        "full_name": u.full_name,
        "role": u.role.value,
        "is_active": u.is_active,
        "is_verified": u.is_verified,
        "created_at": u.created_at.isoformat() if u.created_at else None,
        "last_login": u.last_login.isoformat() if u.last_login else None,
        "subscription": {
            "plan": sub.plan.value,
            "status": sub.status.value,
            "current_period_end": sub.current_period_end.isoformat() if sub and sub.current_period_end else None,
        } if sub else {"plan": "free", "status": "active", "current_period_end": None},
    }

# ── USER MANAGEMENT ───────────────────────────────────────────────────────────

@router.get("/users")
async def list_users(
    search: str | None = Query(None),
    role: str | None = Query(None),
    plan: str | None = Query(None),
    is_active: bool | None = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    q = select(User).options(selectinload(User.subscription)).order_by(desc(User.created_at))
    if search:
        p = f"%{search}%"
        q = q.where(or_(User.email.ilike(p), User.username.ilike(p), User.full_name.ilike(p)))
    if role:
        try:
            q = q.where(User.role == UserRole(role))
        except ValueError:
            pass
    if is_active is not None:
        q = q.where(User.is_active == is_active)
    if plan:
        q = q.join(User.subscription).where(Subscription.plan == SubscriptionPlan(plan))

    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar() or 0
    users = (await db.execute(q.limit(limit).offset(offset))).scalars().all()
    return {"total": total, "users": [_user_dict(u) for u in users]}


@router.post("/users/{user_id}/ban")
async def ban_user(user_id: str, db: AsyncSession = Depends(get_db), current_admin: User = Depends(require_admin)):
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(404, "User not found")
    if str(user.id) == str(current_admin.id):
        raise HTTPException(400, "Cannot ban yourself")
    user.is_active = False
    await db.commit()
    return {"ok": True, "user_id": user_id, "is_active": False}


@router.post("/users/{user_id}/unban")
async def unban_user(user_id: str, db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(404, "User not found")
    user.is_active = True
    await db.commit()
    return {"ok": True, "user_id": user_id, "is_active": True}


@router.post("/users/{user_id}/role")
async def set_role(user_id: str, body: SetRoleBody, db: AsyncSession = Depends(get_db), current_admin: User = Depends(require_admin)):
    if str(current_admin.id) == user_id:
        raise HTTPException(400, "Cannot change your own role")
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(404, "User not found")
    user.role = UserRole(body.role)
    await db.commit()
    return {"ok": True, "user_id": user_id, "role": body.role}


@router.post("/users/{user_id}/subscription")
async def set_subscription(user_id: str, body: SetSubscriptionBody, db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    result = await db.execute(select(User).options(selectinload(User.subscription)).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "User not found")
    if user.subscription:
        user.subscription.plan = SubscriptionPlan(body.plan)
        user.subscription.status = SubscriptionStatus(body.status)
    else:
        db.add(Subscription(user_id=str(user.id), plan=SubscriptionPlan(body.plan), status=SubscriptionStatus(body.status)))
    await db.commit()
    return {"ok": True, "user_id": user_id, "plan": body.plan, "status": body.status}


# ── PREDICTION MANAGEMENT ─────────────────────────────────────────────────────

@router.get("/predictions")
async def admin_predictions(
    search: str | None = Query(None),
    result: str | None = Query(None),
    value_bet: bool | None = Query(None),
    min_confidence: float = Query(0.0, ge=0, le=100),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    from app.models import Team
    q = (
        select(Prediction).join(Prediction.match)
        .options(
            selectinload(Prediction.match).selectinload(Match.home_team),
            selectinload(Prediction.match).selectinload(Match.away_team),
            selectinload(Prediction.match).selectinload(Match.league),
        )
        .order_by(desc(Match.match_date))
    )
    if result:
        try:
            q = q.where(Prediction.result == PredictionResult(result))
        except ValueError:
            pass
    if value_bet is not None:
        q = q.where(Prediction.value_bet == value_bet)
    if min_confidence > 0:
        q = q.where(Prediction.confidence_score >= min_confidence)
    if search:
        p = f"%{search}%"
        home_ids = select(Team.id).where(Team.name.ilike(p)).scalar_subquery()
        away_ids = select(Team.id).where(Team.name.ilike(p)).scalar_subquery()
        league_ids = select(League.id).where(League.name.ilike(p)).scalar_subquery()
        q = q.where(or_(Match.home_team_id.in_(home_ids), Match.away_team_id.in_(away_ids), Match.league_id.in_(league_ids)))

    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar() or 0
    preds = (await db.execute(q.limit(limit).offset(offset))).scalars().all()

    def _p(pred: Prediction) -> dict:
        m = pred.match
        return {
            "id": pred.id,
            "match_date": m.match_date.isoformat(),
            "home_team": m.home_team.name,
            "away_team": m.away_team.name,
            "league": m.league.name,
            "home_win_prob": pred.home_win_prob,
            "draw_prob": pred.draw_prob,
            "away_win_prob": pred.away_win_prob,
            "confidence_score": pred.confidence_score,
            "recommended_bet": pred.recommended_bet,
            "value_bet": pred.value_bet,
            "result": pred.result.value if pred.result else None,
            "is_correct": pred.is_correct,
            "ai_summary": pred.ai_summary,
            "home_score": m.home_score,
            "away_score": m.away_score,
        }

    return {"total": total, "predictions": [_p(p) for p in preds]}


@router.patch("/predictions/{pred_id}")
async def override_prediction(pred_id: int, body: PredictionOverrideBody, db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    pred = (await db.execute(select(Prediction).where(Prediction.id == pred_id))).scalar_one_or_none()
    if not pred:
        raise HTTPException(404, "Prediction not found")
    if body.confidence_score is not None:
        pred.confidence_score = max(0.0, min(100.0, body.confidence_score))
    if body.recommended_bet is not None:
        pred.recommended_bet = body.recommended_bet
    if body.value_bet is not None:
        pred.value_bet = body.value_bet
    if body.ai_summary is not None:
        pred.ai_summary = body.ai_summary
    await db.commit()
    return {"ok": True, "prediction_id": pred_id}


# ── PLATFORM ANALYTICS ────────────────────────────────────────────────────────

@router.get("/stats")
async def platform_stats(db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    now = datetime.now(timezone.utc)

    total_users   = (await db.execute(select(func.count(User.id)))).scalar() or 0
    active_users  = (await db.execute(select(func.count(User.id)).where(User.is_active == True))).scalar() or 0
    admins        = (await db.execute(select(func.count(User.id)).where(User.role == UserRole.ADMIN))).scalar() or 0
    new_7d        = (await db.execute(select(func.count(User.id)).where(User.created_at >= now - timedelta(days=7)))).scalar() or 0

    sub_counts: dict[str, int] = {}
    for plan in SubscriptionPlan:
        cnt = (await db.execute(select(func.count(Subscription.id)).where(Subscription.plan == plan, Subscription.status == SubscriptionStatus.ACTIVE))).scalar() or 0
        sub_counts[plan.value] = cnt

    mrr = sub_counts.get("premium", 0) * 9.99 + sub_counts.get("vip", 0) * 24.99

    total_preds   = (await db.execute(select(func.count(Prediction.id)))).scalar() or 0
    pending_preds = (await db.execute(select(func.count(Prediction.id)).where(Prediction.result == PredictionResult.PENDING))).scalar() or 0
    value_bets    = (await db.execute(select(func.count(Prediction.id)).where(Prediction.value_bet == True))).scalar() or 0
    wins          = (await db.execute(select(func.count(Prediction.id)).where(Prediction.result == PredictionResult.WIN))).scalar() or 0
    settled       = total_preds - pending_preds
    accuracy      = round(wins / settled * 100, 2) if settled else 0.0

    total_matches = (await db.execute(select(func.count(Match.id)))).scalar() or 0
    live_matches  = (await db.execute(select(func.count(Match.id)).where(Match.status == MatchStatus.LIVE))).scalar() or 0

    api_health = await _check_api_health()

    return {
        "users":   {"total": total_users, "active": active_users, "banned": total_users - active_users, "admins": admins, "new_last_7d": new_7d},
        "subscriptions": sub_counts,
        "revenue": {"mrr_estimate": round(mrr, 2), "premium_users": sub_counts.get("premium", 0), "vip_users": sub_counts.get("vip", 0), "free_users": sub_counts.get("free", 0)},
        "predictions": {"total": total_preds, "pending": pending_preds, "settled": settled, "wins": wins, "accuracy_pct": accuracy, "value_bets": value_bets},
        "matches": {"total": total_matches, "live": live_matches},
        "api_health": api_health,
    }


async def _check_api_health() -> dict:
    import asyncio, aiohttp, ssl
    headers = {"User-Agent": "Mozilla/5.0 (compatible; FootballAI/1.0)"}
    ssl_ctx = ssl.create_default_context()
    ssl_ctx.check_hostname = False
    ssl_ctx.verify_mode = ssl.CERT_NONE
    async def _ping(name: str, url: str):
        try:
            async with aiohttp.ClientSession(headers=headers) as s:
                async with s.get(url, timeout=aiohttp.ClientTimeout(total=5), ssl=ssl_ctx) as r:
                    return name, "ok" if r.status < 400 else f"http_{r.status}"
        except asyncio.TimeoutError:
            return name, "timeout"
        except Exception:
            return name, "unreachable"
    results = dict(await asyncio.gather(
        _ping("espn_api", "https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard"),
    ))
    results["database"] = "ok"
    results["prediction_engine"] = "ok"
    return results


# ── DATA INGESTION ────────────────────────────────────────────────────────────

@router.post("/ingest-range")
async def ingest_date_range(days_back: int = Query(60, ge=1, le=365), db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    from app.data_engine.pipeline import ingest_date
    from app.ai.engine import PredictionEngine
    from app.services.backtest_service import BacktestService

    today = date.today()
    ingest_results = []
    for i in range(days_back, 0, -1):
        target = today - timedelta(days=i)
        try:
            r = await ingest_date(target)
            if r.new_matches or r.updated_matches:
                ingest_results.append({"date": target.isoformat(), "new": r.new_matches, "updated": r.updated_matches})
        except Exception as e:
            ingest_results.append({"date": target.isoformat(), "error": str(e)})

    engine = PredictionEngine()
    q = (select(Match).options(selectinload(Match.home_team), selectinload(Match.away_team), selectinload(Match.league))
         .outerjoin(Prediction, Prediction.match_id == Match.id)
         .where(Match.home_score.is_not(None), Prediction.id.is_(None)))
    finished = (await db.execute(q)).scalars().all()

    _PRED_FIELDS = {"home_win_prob","draw_prob","away_win_prob","over_25_prob","under_25_prob","btts_yes_prob","btts_no_prob","home_xg","away_xg","confidence_score","risk_score","value_bet","recommended_bet","ai_summary","tactical_notes","key_factors","odds_home","odds_draw","odds_away","model_version"}
    preds_created = 0
    for match in finished:
        try:
            pred_data = await engine.predict(match)
            db.add(Prediction(match_id=match.id, **{k: v for k, v in pred_data.items() if k in _PRED_FIELDS}))
            preds_created += 1
        except Exception:
            pass
    await db.commit()
    reconcile = await BacktestService(db).reconcile_results()
    return {"ingested_days": len(ingest_results), "predictions_created": preds_created, "reconcile": reconcile}


@router.post("/refresh-odds")
async def refresh_odds(
    hours_ahead: int = Query(72, ge=1, le=168, description="Look-ahead window in hours"),
    _: User = Depends(get_current_user),
):
    """
    Refresh 1X2 odds for all upcoming predictions.

    Uses The Odds API (multi-bookmaker, best accuracy) when ODDS_API_KEY is set,
    otherwise relies on ESPN pickcenter odds fetched lazily per-match.
    """
    from app.data_engine.pipeline import refresh_odds_for_upcoming
    result = await refresh_odds_for_upcoming(hours_ahead=hours_ahead)
    return result
