import enum


class SubscriptionPlan(str, enum.Enum):
    FREE = "free"
    PREMIUM = "premium"
    VIP = "vip"


class SubscriptionStatus(str, enum.Enum):
    ACTIVE = "active"
    CANCELLED = "cancelled"
    EXPIRED = "expired"
    TRIAL = "trial"


class UserRole(str, enum.Enum):
    USER = "user"
    ADMIN = "admin"
    MODERATOR = "moderator"


class MatchStatus(str, enum.Enum):
    SCHEDULED = "scheduled"
    LIVE = "live"
    FINISHED = "finished"
    POSTPONED = "postponed"
    CANCELLED = "cancelled"


class PredictionResult(str, enum.Enum):
    WIN = "win"
    DRAW = "draw"
    LOSS = "loss"
    PENDING = "pending"


class BetType(str, enum.Enum):
    HOME_WIN = "1"
    DRAW = "X"
    AWAY_WIN = "2"
    OVER_25 = "over_2.5"
    UNDER_25 = "under_2.5"
    BTTS_YES = "btts_yes"
    BTTS_NO = "btts_no"
