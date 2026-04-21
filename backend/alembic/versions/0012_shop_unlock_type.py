"""Add unlock_type and unlock_ref to shop_items

Revision ID: 0012
Revises: 0011
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = '0012'
down_revision = '0011'
branch_labels = None
depends_on = None


def _has_column(table: str, column: str) -> bool:
    bind = op.get_bind()
    return column in {c['name'] for c in inspect(bind).get_columns(table)}


def upgrade():
    if not _has_column('shop_items', 'unlock_type'):
        op.add_column('shop_items', sa.Column('unlock_type', sa.String(16), nullable=False, server_default='purchase'))
    if not _has_column('shop_items', 'unlock_ref'):
        op.add_column('shop_items', sa.Column('unlock_ref', sa.String(128), nullable=True))


def downgrade():
    op.drop_column('shop_items', 'unlock_ref')
    op.drop_column('shop_items', 'unlock_type')
