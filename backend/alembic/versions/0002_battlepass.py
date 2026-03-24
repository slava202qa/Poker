"""Add battle pass tables

Revision ID: 0002
Revises: 0001
Create Date: 2025-01-02 00:00:00
"""
from alembic import op
import sqlalchemy as sa

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "battlepass_seasons",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(64), nullable=False),
        sa.Column("total_levels", sa.Integer(), nullable=False, server_default="50"),
        sa.Column("xp_per_level", sa.Integer(), nullable=False, server_default="500"),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
    )

    op.create_table(
        "battlepass_levels",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("season_id", sa.Integer(), sa.ForeignKey("battlepass_seasons.id"), nullable=False),
        sa.Column("level", sa.Integer(), nullable=False),
        sa.Column("free_reward", sa.String(128), nullable=True),
        sa.Column("free_reward_icon", sa.String(16), nullable=True),
        sa.Column("free_reward_amount", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("premium_reward", sa.String(128), nullable=True),
        sa.Column("premium_reward_icon", sa.String(16), nullable=True),
        sa.Column("premium_reward_amount", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_index("ix_battlepass_levels_season_id", "battlepass_levels", ["season_id"])

    op.create_table(
        "user_battlepass",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("season_id", sa.Integer(), sa.ForeignKey("battlepass_seasons.id"), nullable=False),
        sa.Column("current_level", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("current_xp", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_xp_earned", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("claimed_levels", sa.Text(), nullable=False, server_default=""),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_user_battlepass_user_id", "user_battlepass", ["user_id"])


def downgrade() -> None:
    op.drop_table("user_battlepass")
    op.drop_table("battlepass_levels")
    op.drop_table("battlepass_seasons")
