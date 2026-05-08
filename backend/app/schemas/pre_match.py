from pydantic import BaseModel
from app.schemas.prediction import (
    InjuredPlayerInfo, H2HResult, TeamFormEntry, PredictionResponse,
)


class FormSummarySchema(BaseModel):
    wins: int
    draws: int
    losses: int
    goals_scored: float
    goals_conceded: float
    form_string: str
    momentum: float
    clean_sheets: int
    scored_in_all: bool


class GoalTrendsSchema(BaseModel):
    avg_scored: float
    avg_conceded: float
    over_25_rate: float
    btts_rate: float
    first_half_goals: float
    late_goals: bool


class TacticalStyleSchema(BaseModel):
    label: str
    pressing_intensity: str
    defensive_line: str
    build_up: str
    avg_goals_per_game: float


class SquadAnalysisSchema(BaseModel):
    injured: list[InjuredPlayerInfo]
    suspended: list[InjuredPlayerInfo]
    doubtful: list[InjuredPlayerInfo]
    missing_count: int
    impact_score: float
    lineup_shape: str
    key_absences: list[str]


class TacticalMatchupSchema(BaseModel):
    home_advantage_areas: list[str]
    away_advantage_areas: list[str]
    key_battle: str
    pressing_verdict: str
    transition_edge: str
    xg_edge: str
    danger_rating: float


class H2HSummarySchema(BaseModel):
    total_meetings: int
    home_wins: int
    draws: int
    away_wins: int
    avg_total_goals: float
    last_3: list[str]
    home_dominates: bool
    trend: str


class PreMatchAnalysisResponse(BaseModel):
    home_name: str
    away_name: str
    home_form: FormSummarySchema
    away_form: FormSummarySchema
    home_goals: GoalTrendsSchema
    away_goals: GoalTrendsSchema
    home_style: TacticalStyleSchema
    away_style: TacticalStyleSchema
    home_squad: SquadAnalysisSchema
    away_squad: SquadAnalysisSchema
    matchup: TacticalMatchupSchema
    h2h: H2HSummarySchema
    narrative: str
    home_form_entries: list[TeamFormEntry]
    away_form_entries: list[TeamFormEntry]
    head_to_head: list[H2HResult]
    home_injuries_raw: list[InjuredPlayerInfo]
    away_injuries_raw: list[InjuredPlayerInfo]
    prediction: PredictionResponse | None = None
