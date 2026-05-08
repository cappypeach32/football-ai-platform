# Re-export barrel — all existing `from app.models import ...` continue to work.
from app.models.base import UUID  # noqa: F401
from app.models.enums import (  # noqa: F401
    SubscriptionPlan, SubscriptionStatus, UserRole,
    MatchStatus, PredictionResult, BetType,
)
from app.models.user import User, Subscription  # noqa: F401
from app.models.football import League, Team, Player, Match, MatchEvent  # noqa: F401
from app.models.odds import MatchOdds  # noqa: F401
from app.models.prediction import Prediction, UserPredictionInteraction  # noqa: F401
