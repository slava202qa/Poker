"""Add bio, vip_status, vip_expires_at to users

Revision ID: 0011
Revises: 0010
"""
from alembic import op
import sqlalchemy as sa

revision = '0011'
down_revision = '0010'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('users', sa.Column('bio', sa.String(256), nullable=True))
    op.add_column('users', sa.Column('vip_status', sa.String(16), nullable=False, server_default='none'))
    op.add_column('users', sa.Column('vip_expires_at', sa.DateTime(timezone=True), nullable=True))


def downgrade():
    op.drop_column('users', 'vip_expires_at')
    op.drop_column('users', 'vip_status')
    op.drop_column('users', 'bio')
