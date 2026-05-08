from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import Team, Player
from app.schemas import TeamResponse, PlayerResponse

router = APIRouter()


@router.get("/", response_model=list[TeamResponse])
async def list_teams(
    league_id: int | None = Query(None),
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
):
    q = select(Team).limit(limit)
    if league_id:
        q = q.where(Team.league_id == league_id)
    result = await db.execute(q)
    return result.scalars().all()


@router.get("/{team_id}", response_model=TeamResponse)
async def get_team(team_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Team).where(Team.id == team_id))
    team = result.scalar_one_or_none()
    if not team:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")
    return team


@router.get("/{team_id}/players", response_model=list[PlayerResponse])
async def get_team_players(team_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Player).where(Player.team_id == team_id).order_by(Player.importance_score.desc())
    )
    return result.scalars().all()


@router.get("/{team_id}/injuries", response_model=list[PlayerResponse])
async def get_team_injuries(team_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Player).where(
            Player.team_id == team_id,
            (Player.is_injured == True) | (Player.is_suspended == True) | (Player.is_doubtful == True),
        )
    )
    return result.scalars().all()
