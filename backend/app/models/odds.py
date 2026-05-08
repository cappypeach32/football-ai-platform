from datetime import datetime
from sqlalchemy import String, DateTime, Float, Integer, ForeignKey, func, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class MatchOdds(Base):
    """Odds snapshot per match, bookmaker and market — supports history."""
    __tablename__ = "match_odds"
    __table_args__ = (
        Index("ix_match_odds_match_bookmaker", "match_id", "bookmaker"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    match_id: Mapped[int] = mapped_column(Integer, ForeignKey("matches.id", ondelete="CASCADE"), index=True)

    bookmaker: Mapped[str] = mapped_column(String(100), nullable=False, default="betway")

    # 1X2 market
    odds_home: Mapped[float | None] = mapped_column(Float)
    odds_draw: Mapped[float | None] = mapped_column(Float)
    odds_away: Mapped[float | None] = mapped_column(Float)

    # Totals market
    odds_over_25: Mapped[float | None] = mapped_column(Float)
    odds_under_25: Mapped[float | None] = mapped_column(Float)

    # BTTS market
    odds_btts_yes: Mapped[float | None] = mapped_column(Float)
    odds_btts_no: Mapped[float | None] = mapped_column(Float)

    # Timestamp of when these odds were captured
    captured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

    match: Mapped["Match"] = relationship("Match", back_populates="odds_history")
