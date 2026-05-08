from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
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
    q = select(League).order_by(League.tier, League.name)
    if active_only:
        q = q.where(League.is_active == True)
    result = await db.execute(q)
    return result.scalars().all()
