"""Add private table fields: poker_type, action_timer, is_private, password_hash,
invite_token, creator_id.

Revision ID: 0009
Revises: 0008
"""
from alembic import op
import sqlalchemy as sa

revision = '0009'
down_revision = '0008'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("CREATE TYPE pokertype AS ENUM ('holdem', 'omaha')")

    op.add_column('poker_tables', sa.Column(
        'poker_type',
        sa.Enum('holdem', 'omaha', name='pokertype'),
        nullable=False,
        server_default='holdem',
    ))
    op.add_column('poker_tables', sa.Column('action_timer', sa.Integer(), nullable=False, server_default='30'))
    op.add_column('poker_tables', sa.Column('is_private', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('poker_tables', sa.Column('password_hash', sa.String(128), nullable=True))
    op.add_column('poker_tables', sa.Column('invite_token', sa.String(64), nullable=True))
    op.add_column('poker_tables', sa.Column('creator_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True))

    op.create_index('ix_poker_tables_invite_token', 'poker_tables', ['invite_token'])


def downgrade():
    op.drop_index('ix_poker_tables_invite_token', 'poker_tables')
    op.drop_column('poker_tables', 'creator_id')
    op.drop_column('poker_tables', 'invite_token')
    op.drop_column('poker_tables', 'password_hash')
    op.drop_column('poker_tables', 'is_private')
    op.drop_column('poker_tables', 'action_timer')
    op.drop_column('poker_tables', 'poker_type')
    op.execute("DROP TYPE pokertype")
