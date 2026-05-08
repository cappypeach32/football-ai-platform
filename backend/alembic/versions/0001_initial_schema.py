"""Initial schema

Revision ID: 0001
Revises:
Create Date: 2025-01-01 00:00:00
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # leagues
    op.create_table(
        "leagues",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("external_id", sa.String(50), unique=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("country", sa.String(100), nullable=False),
        sa.Column("logo_url", sa.String(512)),
        sa.Column("season", sa.String(20)),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("tier", sa.Integer, server_default="1"),
    )

    # teams
    op.create_table(
        "teams",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("external_id", sa.String(50), unique=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("short_name", sa.String(50)),
        sa.Column("logo_url", sa.String(512)),
        sa.Column("country", sa.String(100)),
        sa.Column("league_id", sa.Integer, sa.ForeignKey("leagues.id")),
        sa.Column("elo_rating", sa.Float, server_default="1500.0"),
        sa.Column("attack_strength", sa.Float, server_default="1.0"),
        sa.Column("defense_weakness", sa.Float, server_default="1.0"),
        sa.Column("home_advantage", sa.Float, server_default="1.0"),
        sa.Column("form_score", sa.Float, server_default="50.0"),
        sa.Column("stats", postgresql.JSON),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # players
    op.create_table(
        "players",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("external_id", sa.String(50)),
        sa.Column("team_id", sa.Integer, sa.ForeignKey("teams.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("position", sa.String(50)),
        sa.Column("nationality", sa.String(100)),
        sa.Column("photo_url", sa.String(512)),
        sa.Column("is_injured", sa.Boolean, server_default="false"),
        sa.Column("is_suspended", sa.Boolean, server_default="false"),
        sa.Column("is_doubtful", sa.Boolean, server_default="false"),
        sa.Column("injury_detail", sa.Text),
        sa.Column("return_date", sa.DateTime(timezone=True)),
        sa.Column("importance_score", sa.Float, server_default="5.0"),
    )

    # users
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("email", sa.String(255), unique=True, nullable=False),
        sa.Column("username", sa.String(100), unique=True, nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(255)),
        sa.Column("avatar_url", sa.String(512)),
        sa.Column("role", sa.String(20), server_default="user"),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("is_verified", sa.Boolean, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("last_login", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_users_email", "users", ["email"])

    # subscriptions
    op.create_table(
        "subscriptions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), unique=True),
        sa.Column("plan", sa.String(20), server_default="free"),
        sa.Column("status", sa.String(20), server_default="active"),
        sa.Column("stripe_customer_id", sa.String(255)),
        sa.Column("stripe_subscription_id", sa.String(255)),
        sa.Column("current_period_start", sa.DateTime(timezone=True)),
        sa.Column("current_period_end", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # matches
    op.create_table(
        "matches",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("external_id", sa.String(50), unique=True),
        sa.Column("league_id", sa.Integer, sa.ForeignKey("leagues.id"), nullable=False),
        sa.Column("home_team_id", sa.Integer, sa.ForeignKey("teams.id"), nullable=False),
        sa.Column("away_team_id", sa.Integer, sa.ForeignKey("teams.id"), nullable=False),
        sa.Column("match_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(20), server_default="scheduled"),
        sa.Column("home_score", sa.Integer),
        sa.Column("away_score", sa.Integer),
        sa.Column("home_score_ht", sa.Integer),
        sa.Column("away_score_ht", sa.Integer),
        sa.Column("minute", sa.Integer),
        sa.Column("venue", sa.String(255)),
        sa.Column("referee", sa.String(255)),
        sa.Column("stats", postgresql.JSON),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_matches_date_league", "matches", ["match_date", "league_id"])
    op.create_index("ix_matches_status", "matches", ["status"])

    # match events
    op.create_table(
        "match_events",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("match_id", sa.Integer, sa.ForeignKey("matches.id", ondelete="CASCADE"), nullable=False),
        sa.Column("minute", sa.Integer, nullable=False),
        sa.Column("event_type", sa.String(50)),
        sa.Column("team", sa.String(10)),
        sa.Column("player_name", sa.String(255)),
        sa.Column("detail", sa.String(255)),
    )
    op.create_index("ix_match_events_match", "match_events", ["match_id"])

    # predictions
    op.create_table(
        "predictions",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("match_id", sa.Integer, sa.ForeignKey("matches.id", ondelete="CASCADE"), unique=True, nullable=False),
        sa.Column("home_win_prob", sa.Float, nullable=False),
        sa.Column("draw_prob", sa.Float, nullable=False),
        sa.Column("away_win_prob", sa.Float, nullable=False),
        sa.Column("over_25_prob", sa.Float, nullable=False),
        sa.Column("under_25_prob", sa.Float, nullable=False),
        sa.Column("btts_yes_prob", sa.Float, nullable=False),
        sa.Column("btts_no_prob", sa.Float, nullable=False),
        sa.Column("home_xg", sa.Float, nullable=False),
        sa.Column("away_xg", sa.Float, nullable=False),
        sa.Column("confidence_score", sa.Float, nullable=False),
        sa.Column("risk_score", sa.Float, nullable=False),
        sa.Column("value_bet", sa.Boolean, server_default="false"),
        sa.Column("recommended_bet", sa.String(50)),
        sa.Column("ai_summary", sa.Text),
        sa.Column("tactical_notes", sa.Text),
        sa.Column("key_factors", postgresql.JSON),
        sa.Column("odds_home", sa.Float),
        sa.Column("odds_draw", sa.Float),
        sa.Column("odds_away", sa.Float),
        sa.Column("result", sa.String(20), server_default="pending"),
        sa.Column("is_correct", sa.Boolean),
        sa.Column("profit_loss", sa.Float),
        sa.Column("model_version", sa.String(50), server_default="1.0.0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_predictions_match_created", "predictions", ["match_id", "created_at"])

    # user_prediction_interactions
    op.create_table(
        "user_prediction_interactions",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE")),
        sa.Column("prediction_id", sa.Integer, sa.ForeignKey("predictions.id", ondelete="CASCADE")),
        sa.Column("liked", sa.Boolean, server_default="false"),
        sa.Column("bookmarked", sa.Boolean, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("user_prediction_interactions")
    op.drop_table("predictions")
    op.drop_table("match_events")
    op.drop_table("matches")
    op.drop_table("subscriptions")
    op.drop_table("users")
    op.drop_table("players")
    op.drop_table("teams")
    op.drop_table("leagues")
