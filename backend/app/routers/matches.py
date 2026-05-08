from datetime import date, datetime
from typing import Literal
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import Match, MatchStatus
from app.schemas import MatchResponse

router = APIRouter()


@router.get("/", response_model=list[MatchResponse])
async def list_matches(
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    league_id: int | None = Query(None),
    status: Literal["scheduled", "live", "finished"] | None = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    db: AsyncSession = Depends(get_db),
):
    q = (
        select(Match)
        .options(
            selectinload(Match.league),
            selectinload(Match.home_team),
            selectinload(Match.away_team),
        )
        .order_by(Match.match_date.asc())
        .limit(limit)
        .offset(offset)
    )
    if date_from:
        q = q.where(Match.match_date >= datetime.combine(date_from, datetime.min.time()))
    if date_to:
        q = q.where(Match.match_date <= datetime.combine(date_to, datetime.max.time()))
    if league_id:
        q = q.where(Match.league_id == league_id)
    if status:
        q = q.where(Match.status == MatchStatus(status))

    result = await db.execute(q)
    return result.scalars().all()


@router.get("/today", response_model=list[MatchResponse])
async def today_matches(db: AsyncSession = Depends(get_db)):
    today = date.today()
    q = (
        select(Match)
        .options(
            selectinload(Match.league),
            selectinload(Match.home_team),
            selectinload(Match.away_team),
        )
        .where(
            Match.match_date >= datetime.combine(today, datetime.min.time()),
            Match.match_date <= datetime.combine(today, datetime.max.time()),
        )
        .order_by(Match.match_date.asc())
    )
    result = await db.execute(q)
    return result.scalars().all()


@router.get("/live", response_model=list[MatchResponse])
async def live_matches(db: AsyncSession = Depends(get_db)):
    q = (
        select(Match)
        .options(
            selectinload(Match.league),
            selectinload(Match.home_team),
            selectinload(Match.away_team),
            selectinload(Match.events),
        )
        .where(Match.status == MatchStatus.LIVE)
        .order_by(Match.match_date.asc())
    )
    result = await db.execute(q)
    return result.scalars().all()


@router.get("/{match_id}", response_model=MatchResponse)
async def get_match(match_id: int, db: AsyncSession = Depends(get_db)):
    q = (
        select(Match)
        .options(
            selectinload(Match.league),
            selectinload(Match.home_team),
            selectinload(Match.away_team),
            selectinload(Match.events),
        )
        .where(Match.id == match_id)
    )
    result = await db.execute(q)
    match = result.scalar_one_or_none()
    if not match:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Match not found")
    return match
