"""Add bio, vip_status, vip_expires_at to users

Revision ID: 0011
Revises: 0010
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = '0011'
down_revision = '0010'
branch_labels = None
depends_on = None


def _has_column(table: str, column: str) -> bool:
    bind = op.get_bind()
    insp = inspect(bind)
    return column in {c['name'] for c in insp.get_columns(table)}


def upgrade():
    if not _has_column('users', 'bio'):
        op.add_column('users', sa.Column('bio', sa.String(256), nullable=True))
    if not _has_column('users', 'vip_status'):
        op.add_column('users', sa.Column('vip_status', sa.String(16), nullable=False, server_default='none'))
    if not _has_column('users', 'vip_expires_at'):
        op.add_column('users', sa.Column('vip_expires_at', sa.DateTime(timezone=True), nullable=True))


def downgrade():
    op.drop_column('users', 'vip_expires_at')
    op.drop_column('users', 'vip_status')
    op.drop_column('users', 'bio')
