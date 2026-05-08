"""Add performance indexes for narrative regeneration and common queries

Revision ID: 0002_perf_indexes
Revises: 0001_initial_schema
Create Date: 2026-05-08
"""
from alembic import op

revision = "0002_perf_indexes"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Speeds up: SELECT ... WHERE ai_summary IS NULL (narrative regeneration batch)
    op.create_index(
        "ix_predictions_no_summary",
        "predictions",
        ["ai_summary"],
        postgresql_where="ai_summary IS NULL",
    )

    # Speeds up: ORDER BY confidence_score DESC (value bets listing)
    op.create_index(
        "ix_predictions_confidence",
        "predictions",
        ["confidence_score"],
    )

    # Speeds up: team name lookups (home/away joins in predictions list)
    op.create_index(
        "ix_teams_name",
        "teams",
        ["name"],
    )

    # Speeds up: external_id lookups (ESPN sync → DB match)
    op.create_index(
        "ix_teams_external_id",
        "teams",
        ["external_id"],
    )
    op.create_index(
        "ix_matches_external_id",
        "matches",
        ["external_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_predictions_no_summary", table_name="predictions")
    op.drop_index("ix_predictions_confidence", table_name="predictions")
    op.drop_index("ix_teams_name", table_name="teams")
    op.drop_index("ix_teams_external_id", table_name="teams")
    op.drop_index("ix_matches_external_id", table_name="matches")
