"""Add multi-market prediction fields

Revision ID: 0003
Revises: 0002_perf_indexes
Create Date: 2026-05-08
"""
from alembic import op
import sqlalchemy as sa

revision = "0003"
down_revision = "0002_perf_indexes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("predictions") as batch_op:
        # Over/Under 1.5 goals
        batch_op.add_column(sa.Column("over_15_prob",  sa.Float(), nullable=True))
        batch_op.add_column(sa.Column("under_15_prob", sa.Float(), nullable=True))
        # Over/Under 3.5 goals
        batch_op.add_column(sa.Column("over_35_prob",  sa.Float(), nullable=True))
        batch_op.add_column(sa.Column("under_35_prob", sa.Float(), nullable=True))
        # Double Chance markets
        batch_op.add_column(sa.Column("dc_1x_prob", sa.Float(), nullable=True))
        batch_op.add_column(sa.Column("dc_12_prob", sa.Float(), nullable=True))
        batch_op.add_column(sa.Column("dc_x2_prob", sa.Float(), nullable=True))
        # Per-market evaluation results stored as JSON
        # e.g. {"1": {"correct": true, "prob": 0.52}, "over_2.5": {"correct": false, "prob": 0.48}}
        batch_op.add_column(sa.Column("market_results", sa.JSON(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("predictions") as batch_op:
        for col in ["over_15_prob", "under_15_prob", "over_35_prob", "under_35_prob",
                    "dc_1x_prob", "dc_12_prob", "dc_x2_prob", "market_results"]:
            batch_op.drop_column(col)
