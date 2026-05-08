from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.football import League
from app.schemas.football import LeagueResponse

router = APIRouter()


@router.get("/", response_model=list[LeagueResponse])
async def list_leagues(
    active_only: bool = Query(True),
    db: AsyncSession = Depends(get_db),
):
    # One entry per unique league name — pick the row with the highest id (most recent season)
    latest_ids = select(func.max(League.id)).group_by(League.name)
    if active_only:
        latest_ids = latest_ids.where(League.is_active == True)
    latest_ids = latest_ids.subquery()

    q = (
        select(League)
        .where(League.id.in_(select(latest_ids)))
        .order_by(League.tier, League.name)
    )
    result = await db.execute(q)
    return result.scalars().all()
