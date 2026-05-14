import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, Enum as SAEnum, func, Boolean, Integer, Float, ForeignKey, Text, JSON, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from app.models.base import UUID
from app.models.enums import PredictionResult


class Prediction(Base):
    __tablename__ = "predictions"
    __table_args__ = (
        Index("ix_predictions_match_created", "match_id", "created_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    match_id: Mapped[int] = mapped_column(Integer, ForeignKey("matches.id", ondelete="CASCADE"), unique=True, index=True)

    home_win_prob: Mapped[float] = mapped_column(Float)
    draw_prob: Mapped[float] = mapped_column(Float)
    away_win_prob: Mapped[float] = mapped_column(Float)
    over_25_prob: Mapped[float] = mapped_column(Float)
    under_25_prob: Mapped[float] = mapped_column(Float)
    over_15_prob: Mapped[float | None] = mapped_column(Float)
    under_15_prob: Mapped[float | None] = mapped_column(Float)
    over_35_prob: Mapped[float | None] = mapped_column(Float)
    under_35_prob: Mapped[float | None] = mapped_column(Float)
    btts_yes_prob: Mapped[float] = mapped_column(Float)
    btts_no_prob: Mapped[float] = mapped_column(Float)
    dc_1x_prob: Mapped[float | None] = mapped_column(Float)
    dc_12_prob: Mapped[float | None] = mapped_column(Float)
    dc_x2_prob: Mapped[float | None] = mapped_column(Float)

    home_xg: Mapped[float] = mapped_column(Float)
    away_xg: Mapped[float] = mapped_column(Float)

    confidence_score: Mapped[float] = mapped_column(Float)
    risk_score: Mapped[float] = mapped_column(Float)
    value_bet: Mapped[bool] = mapped_column(Boolean, default=False)
    recommended_bet: Mapped[str | None] = mapped_column(String(50))

    ai_summary: Mapped[str | None] = mapped_column(Text)
    tactical_notes: Mapped[str | None] = mapped_column(Text)
    key_factors: Mapped[list | None] = mapped_column(JSON)

    odds_home: Mapped[float | None] = mapped_column(Float)
    odds_draw: Mapped[float | None] = mapped_column(Float)
    odds_away: Mapped[float | None] = mapped_column(Float)

    result: Mapped[PredictionResult] = mapped_column(SAEnum(PredictionResult, native_enum=False, values_callable=lambda x: [e.value for e in x]), default=PredictionResult.PENDING)
    is_correct: Mapped[bool | None] = mapped_column(Boolean)
    profit_loss: Mapped[float | None] = mapped_column(Float)
    market_results: Mapped[dict | None] = mapped_column(JSON)

    # Model agreement: how many of the 3 sub-models (Poisson, XGBoost, ELO) agree on recommended bet
    model_agreement: Mapped[int | None] = mapped_column(Integer)   # 1–3
    # Asian handicap line derived from xG differential (e.g. -0.5, +0.75)
    ah_line: Mapped[float | None] = mapped_column(Float)

    model_version: Mapped[str] = mapped_column(String(50), default="1.0.0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    match: Mapped["Match"] = relationship("Match", back_populates="prediction")
    interactions: Mapped[list["UserPredictionInteraction"]] = relationship("UserPredictionInteraction", back_populates="prediction")


class UserPredictionInteraction(Base):
    __tablename__ = "user_prediction_interactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(UUID(), ForeignKey("users.id", ondelete="CASCADE"))
    prediction_id: Mapped[int] = mapped_column(Integer, ForeignKey("predictions.id", ondelete="CASCADE"))
    liked: Mapped[bool] = mapped_column(Boolean, default=False)
    bookmarked: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship("User", back_populates="predictions_liked")
    prediction: Mapped["Prediction"] = relationship("Prediction", back_populates="interactions")

