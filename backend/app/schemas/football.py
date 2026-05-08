from datetime import datetime
from typing import Any
from pydantic import BaseModel


class LeagueResponse(BaseModel):
    id: int
    name: str
    country: str
    logo_url: str | None
    season: str | None
    tier: int

    model_config = {"from_attributes": True}


class TeamResponse(BaseModel):
    id: int
    name: str
    short_name: str | None
    logo_url: str | None
    country: str | None
    elo_rating: float
    form_score: float
    attack_strength: float
    defense_weakness: float

    model_config = {"from_attributes": True}


class PlayerResponse(BaseModel):
    id: int
    name: str
    position: str | None
    photo_url: str | None
    is_injured: bool
    is_suspended: bool
    is_doubtful: bool
    injury_detail: str | None
    return_date: datetime | None
    importance_score: float

    model_config = {"from_attributes": True}


class MatchResponse(BaseModel):
    id: int
    league: LeagueResponse
    home_team: TeamResponse
    away_team: TeamResponse
    match_date: datetime
    status: str
    home_score: int | None
    away_score: int | None
    minute: int | None
    venue: str | None
    stats: dict[str, Any] | None

    model_config = {"from_attributes": True}
