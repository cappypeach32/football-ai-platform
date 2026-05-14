from datetime import datetime
from sqlalchemy import String, DateTime, Enum as SAEnum, func, Boolean, Integer, Float, ForeignKey, Text, JSON, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from app.models.enums import MatchStatus


class League(Base):
    __tablename__ = "leagues"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    external_id: Mapped[str | None] = mapped_column(String(50), unique=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    country: Mapped[str] = mapped_column(String(100), nullable=False)
    logo_url: Mapped[str | None] = mapped_column(String(512))
    season: Mapped[str | None] = mapped_column(String(20))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    tier: Mapped[int] = mapped_column(Integer, default=1)

    # League Intelligence — computed from historical CSVs
    avg_goals_per_game: Mapped[float] = mapped_column(Float, default=0.0)
    draw_rate: Mapped[float] = mapped_column(Float, default=0.0)
    btts_rate: Mapped[float] = mapped_column(Float, default=0.0)
    goals_variance: Mapped[float] = mapped_column(Float, default=0.0)
    home_win_rate: Mapped[float] = mapped_column(Float, default=0.0)
    seasons_computed: Mapped[str | None] = mapped_column(String(255))

    teams: Mapped[list["Team"]] = relationship("Team", back_populates="league")
    matches: Mapped[list["Match"]] = relationship("Match", back_populates="league")


class Team(Base):
    __tablename__ = "teams"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    external_id: Mapped[str | None] = mapped_column(String(50), unique=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    short_name: Mapped[str | None] = mapped_column(String(50))
    logo_url: Mapped[str | None] = mapped_column(String(512))
    country: Mapped[str | None] = mapped_column(String(100))
    league_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("leagues.id"))
    elo_rating: Mapped[float] = mapped_column(Float, default=1500.0)
    attack_strength: Mapped[float] = mapped_column(Float, default=1.0)
    defense_weakness: Mapped[float] = mapped_column(Float, default=1.0)
    home_advantage: Mapped[float] = mapped_column(Float, default=1.0)
    form_score: Mapped[float] = mapped_column(Float, default=50.0)
    stats: Mapped[dict | None] = mapped_column(JSON)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    league: Mapped["League | None"] = relationship("League", back_populates="teams")
    home_matches: Mapped[list["Match"]] = relationship("Match", foreign_keys="Match.home_team_id", back_populates="home_team")
    away_matches: Mapped[list["Match"]] = relationship("Match", foreign_keys="Match.away_team_id", back_populates="away_team")
    players: Mapped[list["Player"]] = relationship("Player", back_populates="team")


class Player(Base):
    __tablename__ = "players"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    external_id: Mapped[str | None] = mapped_column(String(50))
    team_id: Mapped[int] = mapped_column(Integer, ForeignKey("teams.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    position: Mapped[str | None] = mapped_column(String(50))
    nationality: Mapped[str | None] = mapped_column(String(100))
    photo_url: Mapped[str | None] = mapped_column(String(512))
    is_injured: Mapped[bool] = mapped_column(Boolean, default=False)
    is_suspended: Mapped[bool] = mapped_column(Boolean, default=False)
    is_doubtful: Mapped[bool] = mapped_column(Boolean, default=False)
    injury_detail: Mapped[str | None] = mapped_column(Text)
    return_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    importance_score: Mapped[float] = mapped_column(Float, default=5.0)

    team: Mapped["Team"] = relationship("Team", back_populates="players")


class Match(Base):
    __tablename__ = "matches"
    __table_args__ = (
        Index("ix_matches_date_league", "match_date", "league_id"),
        Index("ix_matches_status", "status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    external_id: Mapped[str | None] = mapped_column(String(50), unique=True)
    league_id: Mapped[int] = mapped_column(Integer, ForeignKey("leagues.id"))
    home_team_id: Mapped[int] = mapped_column(Integer, ForeignKey("teams.id"))
    away_team_id: Mapped[int] = mapped_column(Integer, ForeignKey("teams.id"))
    match_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    status: Mapped[MatchStatus] = mapped_column(
        SAEnum(MatchStatus, native_enum=False, values_callable=lambda x: [e.value for e in x]),
        default=MatchStatus.SCHEDULED,
    )
    home_score: Mapped[int | None] = mapped_column(Integer)
    away_score: Mapped[int | None] = mapped_column(Integer)
    home_score_ht: Mapped[int | None] = mapped_column(Integer)
    away_score_ht: Mapped[int | None] = mapped_column(Integer)
    minute: Mapped[int | None] = mapped_column(Integer)
    venue: Mapped[str | None] = mapped_column(String(255))
    referee: Mapped[str | None] = mapped_column(String(255))
    stats: Mapped[dict | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    league: Mapped["League"] = relationship("League", back_populates="matches")
    home_team: Mapped["Team"] = relationship("Team", foreign_keys=[home_team_id], back_populates="home_matches")
    away_team: Mapped["Team"] = relationship("Team", foreign_keys=[away_team_id], back_populates="away_matches")
    prediction: Mapped["Prediction | None"] = relationship("Prediction", back_populates="match", uselist=False)
    events: Mapped[list["MatchEvent"]] = relationship("MatchEvent", back_populates="match", order_by="MatchEvent.minute")
    odds_history: Mapped[list["MatchOdds"]] = relationship("MatchOdds", back_populates="match", order_by="MatchOdds.captured_at")


class MatchEvent(Base):
    __tablename__ = "match_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    match_id: Mapped[int] = mapped_column(Integer, ForeignKey("matches.id", ondelete="CASCADE"), index=True)
    minute: Mapped[int] = mapped_column(Integer, nullable=False)
    event_type: Mapped[str] = mapped_column(String(50))
    team: Mapped[str] = mapped_column(String(10))
    player_name: Mapped[str | None] = mapped_column(String(255))
    detail: Mapped[str | None] = mapped_column(String(255))

    match: Mapped["Match"] = relationship("Match", back_populates="events")

