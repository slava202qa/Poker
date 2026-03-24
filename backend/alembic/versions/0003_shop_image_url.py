"""add image_url to shop_items

Revision ID: 0003
Revises: 0002
Create Date: 2026-03-24
"""
from alembic import op
import sqlalchemy as sa

revision = '0003'
down_revision = '0002'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('shop_items', sa.Column('image_url', sa.String(512), nullable=True))


def downgrade():
    op.drop_column('shop_items', 'image_url')
