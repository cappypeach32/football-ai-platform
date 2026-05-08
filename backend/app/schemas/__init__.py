# Re-export barrel — all existing `from app.schemas import ...` continue to work.
from app.schemas.auth import (  # noqa: F401
    UserBase, UserCreate, UserLogin, UserResponse, TokenResponse,
)
from app.schemas.football import (  # noqa: F401
    LeagueResponse, TeamResponse, PlayerResponse, MatchResponse,
)
from app.schemas.prediction import (  # noqa: F401
    InjuredPlayerInfo, H2HResult, TeamFormEntry,
    PredictionResponse, MatchAnalysisResponse, BacktestSummary,
)
from app.schemas.pre_match import (  # noqa: F401
    FormSummarySchema, GoalTrendsSchema, TacticalStyleSchema,
    SquadAnalysisSchema, TacticalMatchupSchema, H2HSummarySchema,
    PreMatchAnalysisResponse,
)
from app.schemas.live import LiveMatchUpdate, AnalyticsOverview  # noqa: F401
