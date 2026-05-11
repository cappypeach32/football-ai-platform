from datetime import datetime
from typing import Any
from pydantic import BaseModel
from app.schemas.football import MatchResponse


class InjuredPlayerInfo(BaseModel):
    name: str
    position: str | None = None
    status: str  # "injured" | "suspended" | "doubtful"
    detail: str | None = None
    return_date: str | None = None
    photo_url: str | None = None
    chance_of_playing: int | None = None  # 0-100 from FPL


class H2HResult(BaseModel):
    date: str
    home_team: str
    away_team: str
    home_score: int
    away_score: int
    competition: str | None = None


class TeamFormEntry(BaseModel):
    date: str
    opponent: str
    home_or_away: str  # "H" | "A"
    goals_for: int
    goals_against: int
    result: str  # "W" | "D" | "L"
    competition: str | None = None


class PredictionResponse(BaseModel):
    id: int
    match: MatchResponse
    home_win_prob: float
    draw_prob: float
    away_win_prob: float
    over_25_prob: float
    under_25_prob: float
    btts_yes_prob: float
    btts_no_prob: float
    home_xg: float
    away_xg: float
    confidence_score: float
    risk_score: float
    value_bet: bool
    recommended_bet: str | None
    ai_summary: str | None
    tactical_notes: str | None
    key_factors: list[str] | None
    odds_home: float | None
    odds_draw: float | None
    odds_away: float | None
    model_agreement: int | None = None
    ah_line: float | None = None
    result: str
    model_version: str
    created_at: datetime

    model_config = {"from_attributes": True}


class MatchAnalysisResponse(BaseModel):
    prediction: PredictionResponse
    home_injuries: list[InjuredPlayerInfo]
    away_injuries: list[InjuredPlayerInfo]
    home_form: list[TeamFormEntry]
    away_form: list[TeamFormEntry]
    head_to_head: list[H2HResult]
    home_goals_scored_avg: float
    home_goals_conceded_avg: float
    away_goals_scored_avg: float
    away_goals_conceded_avg: float
    home_form_string: str
    away_form_string: str
    venue: str | None = None
    referee: str | None = None


class BacktestSummary(BaseModel):
    total_predictions: int
    correct_predictions: int
    accuracy: float
    roi: float
    total_profit_loss: float
    avg_confidence: float
    by_league: dict[str, Any]
    by_market: dict[str, Any] = {}
    by_confidence_tier: dict[str, Any]
    monthly_performance: list[dict[str, Any]]
