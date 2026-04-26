"""add is_unlimited_balance to users

Revision ID: 0014
Revises: 0013
Create Date: 2025-01-01
"""
from alembic import op

revision = '0014'
down_revision = '0013'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS is_unlimited_balance BOOLEAN NOT NULL DEFAULT FALSE
    """)


def downgrade():
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS is_unlimited_balance")
