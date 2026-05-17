from fastapi import APIRouter, Depends, Query, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, or_, func, case
from sqlalchemy.orm import selectinload, aliased
from datetime import date

from app.database import get_db
from app.models import Prediction, Match, MatchStatus
from app.schemas import PredictionResponse, MatchAnalysisResponse, PreMatchAnalysisResponse
from app.dependencies import get_current_user, require_premium
from app.models import User
from app.ai.engine import PredictionEngine
from app.ai.analysis_engine import generate_pre_match_analysis
from app.data_engine.pipeline import get_team_form, get_team_injuries, get_h2h, refresh_match_odds

router = APIRouter()
_engine = PredictionEngine()


@router.get("/", response_model=list[PredictionResponse])
async def list_predictions(
    league_id: int | None = Query(None),
    min_confidence: float = Query(0.0, ge=0, le=100),
    value_bets_only: bool = Query(False),
    upcoming_only: bool = Query(True, description="Only return matches scheduled in the future"),
    team_name: str | None = Query(None, description="Filter by home or away team name (case-insensitive)"),
    from_date: date | None = Query(None, description="Local calendar date floor (YYYY-MM-DD). Prevents yesterday's finished matches from showing after midnight in positive UTC offsets."),
    limit: int = Query(20, le=100),
    offset: int = Query(0),
    db: AsyncSession = Depends(get_db),
):
    from app.models import Team
    from datetime import datetime, timedelta, time as dtime
    home_alias = aliased(Team, name="home_t")
    away_alias = aliased(Team, name="away_t")

    q = (
        select(Prediction)
        .join(Prediction.match)
        .join(home_alias, Match.home_team_id == home_alias.id)
        .join(away_alias, Match.away_team_id == away_alias.id)
        .options(
            selectinload(Prediction.match).selectinload(Match.league),
            selectinload(Prediction.match).selectinload(Match.home_team),
            selectinload(Prediction.match).selectinload(Match.away_team),
        )
        .where(Prediction.confidence_score >= min_confidence)
        .limit(limit)
        .offset(offset)
    )
    if upcoming_only:
        # 3-hour lookback for in-play detection, but floored by from_date midnight so
        # yesterday's finished matches never bleed through for users in UTC+ timezones.
        in_play_cutoff = datetime.utcnow() - timedelta(hours=3)
        if from_date:
            date_floor = datetime.combine(from_date, dtime(0, 0, 0))
            cutoff = max(in_play_cutoff, date_floor)
        else:
            cutoff = in_play_cutoff
        q = q.where(Match.match_date >= cutoff)
    if league_id:
        q = q.where(Match.league_id == league_id)
    if value_bets_only:
        q = q.where(Prediction.value_bet == True)
    if team_name:
        pattern = f"%{team_name}%"
        q = q.where(or_(
            home_alias.name.ilike(pattern),
            away_alias.name.ilike(pattern),
        ))
        if not upcoming_only:
            # When fetching all (including past), sort closest to now first
            # Use PostgreSQL-compatible EXTRACT(EPOCH FROM ...) instead of SQLite strftime
            now_ts = datetime.utcnow().timestamp()
            q = q.order_by(
                func.abs(func.extract("epoch", Match.match_date) - now_ts),
                desc(Prediction.confidence_score),
            )
        else:
            q = q.order_by(Match.match_date, desc(Prediction.confidence_score))
    else:
        # Soonest upcoming first, then by confidence within same-day matches
        q = q.order_by(Match.match_date, desc(Prediction.confidence_score))

    result = await db.execute(q)
    return result.scalars().all()

    result = await db.execute(q)
    return result.scalars().all()


@router.get("/hero", response_model=PredictionResponse | None)
async def hero_prediction(
    from_date: date | None = Query(None, description="Local calendar date (YYYY-MM-DD) floor"),
    db: AsyncSession = Depends(get_db),
):
    """
    Single best AI edge pick for today — highest-confidence value bet with market odds.
    Returns null if no qualifying pick is available.
    """
    from datetime import datetime, timedelta, time as dtime
    today = from_date or date.today()

    date_floor = datetime.combine(today, dtime(0, 0, 0))
    date_ceil  = datetime.combine(today, dtime(23, 59, 59))
    in_play_cutoff = datetime.utcnow() - timedelta(hours=3)
    cutoff = max(in_play_cutoff, date_floor)

    q = (
        select(Prediction)
        .join(Prediction.match)
        .options(
            selectinload(Prediction.match).selectinload(Match.league),
            selectinload(Prediction.match).selectinload(Match.home_team),
            selectinload(Prediction.match).selectinload(Match.away_team),
        )
        .where(
            Match.match_date >= cutoff,
            Match.match_date <= date_ceil,
            Prediction.value_bet == True,
            # Must have market odds to compute an edge
            or_(
                Prediction.odds_home.is_not(None),
                Prediction.odds_draw.is_not(None),
                Prediction.odds_away.is_not(None),
            ),
        )
        .order_by(desc(Prediction.confidence_score))
        .limit(1)
    )
    result = await db.execute(q)
    pred = result.scalars().first()

    # Fallback: best confidence pick for today, no minimum threshold
    if pred is None:
        q2 = (
            select(Prediction)
            .join(Prediction.match)
            .options(
                selectinload(Prediction.match).selectinload(Match.league),
                selectinload(Prediction.match).selectinload(Match.home_team),
                selectinload(Prediction.match).selectinload(Match.away_team),
            )
            .where(
                Match.match_date >= cutoff,
                Match.match_date <= date_ceil,
            )
            .order_by(desc(Prediction.confidence_score))
            .limit(1)
        )
        result2 = await db.execute(q2)
        pred = result2.scalars().first()

    return pred


@router.get("/top", response_model=list[PredictionResponse])
async def top_predictions(db: AsyncSession = Depends(get_db)):
    """Today's best AI picks."""
    from datetime import date, datetime
    today = date.today()
    q = (
        select(Prediction)
        .join(Prediction.match)
        .options(
            selectinload(Prediction.match).selectinload(Match.league),
            selectinload(Prediction.match).selectinload(Match.home_team),
            selectinload(Prediction.match).selectinload(Match.away_team),
        )
        .where(
            Match.match_date >= datetime.combine(today, datetime.min.time()),
            Match.match_date <= datetime.combine(today, datetime.max.time()),
            Prediction.confidence_score >= 65,
        )
        .order_by(desc(Prediction.confidence_score))
        .limit(10)
    )
    result = await db.execute(q)
    return result.scalars().all()


@router.get("/{prediction_id}", response_model=PredictionResponse)
async def get_prediction(
    prediction_id: int,
    db: AsyncSession = Depends(get_db),
):
    q = (
        select(Prediction)
        .options(
            selectinload(Prediction.match).selectinload(Match.league),
            selectinload(Prediction.match).selectinload(Match.home_team),
            selectinload(Prediction.match).selectinload(Match.away_team),
        )
        .where(Prediction.id == prediction_id)
    )
    result = await db.execute(q)
    pred = result.scalar_one_or_none()
    if not pred:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prediction not found")
    return pred


@router.get("/{prediction_id}/analysis", response_model=MatchAnalysisResponse)
async def get_match_analysis(
    prediction_id: int,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Full match analysis: prediction + injuries + form + H2H (all cached)."""
    q = (
        select(Prediction)
        .options(
            selectinload(Prediction.match).selectinload(Match.league),
            selectinload(Prediction.match).selectinload(Match.home_team),
            selectinload(Prediction.match).selectinload(Match.away_team),
        )
        .where(Prediction.id == prediction_id)
    )
    result = await db.execute(q)
    pred = result.scalar_one_or_none()
    if not pred:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prediction not found")

    match = pred.match
    home_team = match.home_team
    away_team = match.away_team
    league_slug = match.league.external_id or "ENG.1"

    # Fetch via pipeline (cache-first, ESPN fallback)
    import asyncio as _asyncio
    home_injuries, away_injuries, home_form, away_form, h2h = await _asyncio.gather(
        get_team_injuries(home_team.external_id or "", home_team.name, league_slug),
        get_team_injuries(away_team.external_id or "", away_team.name, league_slug),
        get_team_form(home_team.external_id or "", league_slug, home_team.name),
        get_team_form(away_team.external_id or "", league_slug, away_team.name),
        get_h2h(home_team.external_id or "", away_team.external_id or "", league_slug, home_team.name, away_team.name),
    )

    # Refresh odds from ESPN pickcenter in background (non-blocking)
    background_tasks.add_task(refresh_match_odds, match, league_slug, db)

    def _avg(form, for_: bool) -> float:
        vals = [e.goals_for if for_ else e.goals_against for e in form]
        return round(sum(vals) / len(vals), 2) if vals else 0.0

    def _form_string(form) -> str:
        return " ".join(e.result for e in form) if form else "— — — — —"

    hgs = _avg(home_form, True)  or round(home_team.attack_strength * 1.2, 2)
    hgc = _avg(home_form, False) or round(home_team.defense_weakness * 1.1, 2)
    ags = _avg(away_form, True)  or round(away_team.attack_strength * 1.1, 2)
    agc = _avg(away_form, False) or round(away_team.defense_weakness * 1.1, 2)

    return MatchAnalysisResponse(
        prediction=pred,
        home_injuries=home_injuries,
        away_injuries=away_injuries,
        home_form=home_form,
        away_form=away_form,
        head_to_head=h2h,
        home_goals_scored_avg=hgs,
        home_goals_conceded_avg=hgc,
        away_goals_scored_avg=ags,
        away_goals_conceded_avg=agc,
        home_form_string=_form_string(home_form),
        away_form_string=_form_string(away_form),
        venue=match.venue,
        referee=match.referee,
    )


# ─── Odds History ─────────────────────────────────────────────────────────────

from pydantic import BaseModel as _BaseModel


class OddsSnapshot(_BaseModel):
    timestamp: str
    home: float
    draw: float
    away: float


class OddsHistoryResponse(_BaseModel):
    match_id: int
    home_team: str
    away_team: str
    current: OddsSnapshot
    history: list[OddsSnapshot]
    movement: dict  # home/draw/away: "up" | "down" | "stable"


@router.get("/{prediction_id}/odds-history", response_model=OddsHistoryResponse)
async def get_odds_history(
    prediction_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Return odds history. Uses DB snapshots when available,
    otherwise generates realistic synthetic movement from the current odds."""
    import random
    from datetime import datetime, timedelta
    from sqlalchemy import asc
    from app.models import MatchOdds

    q = (
        select(Prediction)
        .options(
            selectinload(Prediction.match).selectinload(Match.home_team),
            selectinload(Prediction.match).selectinload(Match.away_team),
        )
        .where(Prediction.id == prediction_id)
    )
    result = await db.execute(q)
    pred = result.scalar_one_or_none()
    if not pred:
        raise HTTPException(status_code=404, detail="Prediction not found")

    match = pred.match
    curr_home = pred.odds_home or 2.0
    curr_draw = pred.odds_draw or 3.3
    curr_away = pred.odds_away or 3.5

    snaps_q = (
        select(MatchOdds)
        .where(MatchOdds.match_id == match.id)
        .order_by(asc(MatchOdds.captured_at))
        .limit(48)
    )
    snaps_result = await db.execute(snaps_q)
    snaps = snaps_result.scalars().all()

    now = datetime.utcnow()

    if len(snaps) >= 3:
        history = [
            OddsSnapshot(
                timestamp=s.captured_at.isoformat(),
                home=round(s.odds_home or curr_home, 2),
                draw=round(s.odds_draw or curr_draw, 2),
                away=round(s.odds_away or curr_away, 2),
            )
            for s in snaps
        ]
    else:
        rng = random.Random(match.id * 7 + prediction_id)

        def _drift(start: float, end: float, step: int, total: int) -> float:
            progress = step / max(total, 1)
            base = start + (end - start) * (progress ** 1.4)
            jitter = rng.gauss(0, start * 0.012)
            return round(max(1.02, base + jitter), 2)

        h0 = curr_home * rng.uniform(0.88, 1.14)
        d0 = curr_draw * rng.uniform(0.90, 1.10)
        a0 = curr_away * rng.uniform(0.86, 1.16)
        total = 24
        history = [
            OddsSnapshot(
                timestamp=(now - timedelta(hours=total - i)).isoformat(),
                home=_drift(h0, curr_home, i, total - 1),
                draw=_drift(d0, curr_draw, i, total - 1),
                away=_drift(a0, curr_away, i, total - 1),
            )
            for i in range(total)
        ]

    current = OddsSnapshot(
        timestamp=now.isoformat(),
        home=round(curr_home, 2),
        draw=round(curr_draw, 2),
        away=round(curr_away, 2),
    )

    def _dir(key: str) -> str:
        if len(history) < 2:
            return "stable"
        first, last = getattr(history[0], key), getattr(history[-1], key)
        if abs(last - first) / first < 0.015:
            return "stable"
        return "down" if last < first else "up"

    return OddsHistoryResponse(
        match_id=match.id,
        home_team=match.home_team.name,
        away_team=match.away_team.name,
        current=current,
        history=history,
        movement={"home": _dir("home"), "draw": _dir("draw"), "away": _dir("away")},
    )


@router.get("/{prediction_id}/pre-match", response_model=PreMatchAnalysisResponse)
async def get_pre_match_analysis(
    prediction_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Deep pre-match analysis:
    Team overview · Squad analysis · Tactical matchup · H2H · AI narrative.
    """
    q = (
        select(Prediction)
        .options(
            selectinload(Prediction.match).selectinload(Match.league),
            selectinload(Prediction.match).selectinload(Match.home_team),
            selectinload(Prediction.match).selectinload(Match.away_team),
        )
        .where(Prediction.id == prediction_id)
    )
    result = await db.execute(q)
    pred = result.scalar_one_or_none()
    if not pred:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prediction not found")

    match      = pred.match
    home_team  = match.home_team
    away_team  = match.away_team
    league_slug = match.league.external_id or "ENG.1"

    import asyncio as _asyncio
    home_form, away_form, home_inj, away_inj, h2h = await _asyncio.gather(
        get_team_form(home_team.external_id or "", league_slug, home_team.name),
        get_team_form(away_team.external_id or "", league_slug, away_team.name),
        get_team_injuries(home_team.external_id or "", home_team.name, league_slug),
        get_team_injuries(away_team.external_id or "", away_team.name, league_slug),
        get_h2h(home_team.external_id or "", away_team.external_id or "", league_slug, home_team.name, away_team.name),
    )

    analysis = generate_pre_match_analysis(
        home_name=home_team.name,
        away_name=away_team.name,
        home_elo=home_team.elo_rating,
        away_elo=away_team.elo_rating,
        home_form_entries=home_form,
        away_form_entries=away_form,
        home_injuries=home_inj,
        away_injuries=away_inj,
        h2h_entries=h2h,
    )

    # Regenerate and persist the richer narrative now that we have live features
    try:
        from app.ai.features import extract_features
        features = extract_features(
            match=match,
            home_form=home_form,
            away_form=away_form,
            home_injuries=home_inj,
            away_injuries=away_inj,
            h2h=h2h,
        )
        pred_data = await _engine.predict(match, features=features)
        pred.ai_summary     = pred_data["ai_summary"]
        pred.tactical_notes = pred_data["tactical_notes"]
        pred.key_factors    = pred_data["key_factors"]
        await db.commit()
    except Exception as _exc:
        import structlog as _sl
        _sl.get_logger().warning("narrative_regen_failed", error=str(_exc))

    def _dc(obj) -> dict:
        from dataclasses import asdict
        return asdict(obj)

    return PreMatchAnalysisResponse(
        home_name=home_team.name,
        away_name=away_team.name,
        home_form=_dc(analysis.home_form),
        away_form=_dc(analysis.away_form),
        home_goals=_dc(analysis.home_goals),
        away_goals=_dc(analysis.away_goals),
        home_style=_dc(analysis.home_style),
        away_style=_dc(analysis.away_style),
        home_squad=dict(
            **{k: v for k, v in _dc(analysis.home_squad).items()
               if k not in ("injured", "suspended", "doubtful")},
            injured=[p.__dict__ if hasattr(p, "__dict__") else p for p in analysis.home_squad.injured],
            suspended=[p.__dict__ if hasattr(p, "__dict__") else p for p in analysis.home_squad.suspended],
            doubtful=[p.__dict__ if hasattr(p, "__dict__") else p for p in analysis.home_squad.doubtful],
        ),
        away_squad=dict(
            **{k: v for k, v in _dc(analysis.away_squad).items()
               if k not in ("injured", "suspended", "doubtful")},
            injured=[p.__dict__ if hasattr(p, "__dict__") else p for p in analysis.away_squad.injured],
            suspended=[p.__dict__ if hasattr(p, "__dict__") else p for p in analysis.away_squad.suspended],
            doubtful=[p.__dict__ if hasattr(p, "__dict__") else p for p in analysis.away_squad.doubtful],
        ),
        matchup=_dc(analysis.matchup),
        h2h=_dc(analysis.h2h),
        narrative=analysis.narrative,
        home_form_entries=home_form,
        away_form_entries=away_form,
        head_to_head=h2h,
        home_injuries_raw=home_inj,
        away_injuries_raw=away_inj,
        prediction=pred,
    )


@router.post("/generate/{match_id}", response_model=PredictionResponse)
async def generate_prediction(
    match_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_premium),
):
    """Trigger AI prediction generation for a specific match."""
    q = (
        select(Match)
        .options(
            selectinload(Match.league),
            selectinload(Match.home_team),
            selectinload(Match.away_team),
        )
        .where(Match.id == match_id)
    )
    result = await db.execute(q)
    match = result.scalar_one_or_none()
    if not match:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Match not found")

    pred_data = await _engine.predict(match)

    # Attempt to enrich with live features (form + injuries + H2H)
    try:
        import asyncio as _a
        from app.ai.features import extract_features
        home_form, away_form, home_inj_g, away_inj_g, h2h_g = await _a.gather(
            get_team_form(match.home_team.external_id or "", match.league.external_id or "ENG.1", match.home_team.name),
            get_team_form(match.away_team.external_id or "", match.league.external_id or "ENG.1", match.away_team.name),
            get_team_injuries(match.home_team.external_id or "", match.home_team.name, match.league.external_id or "ENG.1"),
            get_team_injuries(match.away_team.external_id or "", match.away_team.name, match.league.external_id or "ENG.1"),
            get_h2h(match.home_team.external_id or "", match.away_team.external_id or "", match.league.external_id or "ENG.1", match.home_team.name, match.away_team.name),
        )
        features = extract_features(match=match, home_form=home_form, away_form=away_form,
                                     home_injuries=home_inj_g, away_injuries=away_inj_g, h2h=h2h_g)
        rich_data = await _engine.predict(match, features=features)
        pred_data.update({k: rich_data[k] for k in ("ai_summary", "tactical_notes", "key_factors",
                                                      "home_xg", "away_xg", "confidence_score", "risk_score")})
    except Exception:
        pass  # fall back to base prediction

    prediction = Prediction(match_id=match_id, **pred_data)
    db.add(prediction)
    await db.commit()
    await db.refresh(prediction)
    return prediction


# ─── Injury Impact Center ─────────────────────────────────────────────────────

from app.data_engine.sources import fpl as _fpl_src


class AbsentPlayer(_BaseModel):
    web_name: str
    position: str
    status: str
    xg: float
    xa: float
    ict_index: float
    threat: float
    influence: float
    minutes: int
    now_cost: int
    chance_of_playing: int | None


class TeamInjuryImpact(_BaseModel):
    team: str
    absent_count: int
    missing_xg: float
    missing_xa: float
    missing_xg_pct: float
    most_impactful: str | None
    most_impactful_pos: str | None
    most_impactful_xg: float
    most_impactful_role: str | None
    defenders_out: int
    attack_impact: str          # "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
    defensive_stability_pct: int  # e.g. -18
    impact_level: str           # "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
    prob_shift: float           # estimated win probability change in pp
    ai_summary: str
    absent_players: list[AbsentPlayer]


class InjuryImpactResponse(_BaseModel):
    prediction_id: int
    league_slug: str
    is_pl_only: bool
    home: TeamInjuryImpact | None
    away: TeamInjuryImpact | None


@router.get("/{prediction_id}/injury-impact", response_model=InjuryImpactResponse)
async def get_injury_impact(
    prediction_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Injury Impact Center: for each team compute missing xG, most impactful absence,
    defensive gaps, and estimated probability shift caused by current injuries.
    Premier League only (FPL data). Other leagues return empty impact objects.
    """
    import asyncio as _ai

    q = (
        select(Prediction)
        .options(
            selectinload(Prediction.match).selectinload(Match.league),
            selectinload(Prediction.match).selectinload(Match.home_team),
            selectinload(Prediction.match).selectinload(Match.away_team),
        )
        .where(Prediction.id == prediction_id)
    )
    result = await db.execute(q)
    pred = result.scalar_one_or_none()
    if not pred:
        raise HTTPException(status_code=404, detail="Prediction not found")

    match = pred.match
    league_slug = match.league.external_id or ""
    is_pl = league_slug == "ENG.1"

    if not is_pl:
        empty = TeamInjuryImpact(
            team="",
            absent_count=0,
            missing_xg=0.0,
            missing_xa=0.0,
            missing_xg_pct=0.0,
            most_impactful=None,
            most_impactful_pos=None,
            most_impactful_xg=0.0,
            most_impactful_role=None,
            defenders_out=0,
            attack_impact="LOW",
            defensive_stability_pct=0,
            impact_level="LOW",
            prob_shift=0.0,
            ai_summary="Injury data not available for this league.",
            absent_players=[],
        )
        return InjuryImpactResponse(
            prediction_id=prediction_id,
            league_slug=league_slug,
            is_pl_only=True,
            home=empty,
            away=empty,
        )

    home_raw, away_raw = await _ai.gather(
        _fpl_src.fetch_injury_impact(match.home_team.name),
        _fpl_src.fetch_injury_impact(match.away_team.name),
    )

    def _build(raw: dict, team_name: str) -> TeamInjuryImpact:
        if not raw:
            return TeamInjuryImpact(
                team=team_name,
                absent_count=0,
                missing_xg=0.0,
                missing_xa=0.0,
                missing_xg_pct=0.0,
                most_impactful=None,
                most_impactful_pos=None,
                most_impactful_xg=0.0,
                most_impactful_role=None,
                defenders_out=0,
                attack_impact="LOW",
                defensive_stability_pct=0,
                impact_level="LOW",
                prob_shift=0.0,
                ai_summary="No injury data available.",
                absent_players=[],
            )
        return TeamInjuryImpact(
            team=raw.get("team", team_name),
            absent_count=raw["absent_count"],
            missing_xg=raw["missing_xg"],
            missing_xa=raw["missing_xa"],
            missing_xg_pct=raw["missing_xg_pct"],
            most_impactful=raw.get("most_impactful"),
            most_impactful_pos=raw.get("most_impactful_pos"),
            most_impactful_xg=raw.get("most_impactful_xg", 0.0),
            most_impactful_role=raw.get("most_impactful_role"),
            defenders_out=raw["defenders_out"],
            attack_impact=raw.get("attack_impact", "LOW"),
            defensive_stability_pct=raw.get("defensive_stability_pct", 0),
            impact_level=raw["impact_level"],
            prob_shift=raw["prob_shift"],
            ai_summary=raw.get("ai_summary", ""),
            absent_players=[AbsentPlayer(**p) for p in raw.get("absent_players", [])],
        )

    return InjuryImpactResponse(
        prediction_id=prediction_id,
        league_slug=league_slug,
        is_pl_only=True,
        home=_build(home_raw, match.home_team.name),
        away=_build(away_raw, match.away_team.name),
    )
