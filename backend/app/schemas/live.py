from typing import Any
from pydantic import BaseModel


class LiveMatchUpdate(BaseModel):
    match_id: int
    minute: int
    home_score: int
    away_score: int
    home_win_prob: float
    draw_prob: float
    away_win_prob: float
    home_xg: float
    away_xg: float
    possession_home: float
    shots_home: int
    shots_away: int
    dangerous_attacks_home: int
    dangerous_attacks_away: int
    momentum: float  # -1 to 1, positive = home dominance


class AnalyticsOverview(BaseModel):
    total_matches: int
    total_predictions: int
    overall_accuracy: float
    value_bets_roi: float
    overall_roi: float = 0.0
    resolved_bets: int = 0
    top_leagues: list[dict[str, Any]]
    accuracy_by_market: dict[str, dict]
    recent_form: list[dict[str, Any]]
