from fastapi import APIRouter, Depends, Query, HTTPException, status
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
from app.data_engine.pipeline import get_team_form, get_team_injuries, get_h2h

router = APIRouter()
_engine = PredictionEngine()


@router.get("/", response_model=list[PredictionResponse])
async def list_predictions(
    league_id: int | None = Query(None),
    min_confidence: float = Query(0.0, ge=0, le=100),
    value_bets_only: bool = Query(False),
    team_name: str | None = Query(None, description="Filter by home or away team name (case-insensitive)"),
    limit: int = Query(20, le=100),
    offset: int = Query(0),
    db: AsyncSession = Depends(get_db),
):
    from app.models import Team
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
        # Order by proximity to today (closest match first), then confidence
        today_str = date.today().isoformat()
        q = q.order_by(
            func.abs(func.julianday(Match.match_date) - func.julianday(today_str)),
            desc(Prediction.confidence_score),
        )
    else:
        q = q.order_by(desc(Prediction.confidence_score))

    result = await db.execute(q)
    return result.scalars().all()


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
