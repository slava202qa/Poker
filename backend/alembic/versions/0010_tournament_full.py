"""Add full tournament fields: type, seats_per_table, blind_level_minutes,
late_reg_levels, guaranteed_prize, min_players, is_private, password_hash.

Revision ID: 0010
Revises: 0009
"""
from alembic import op
import sqlalchemy as sa

revision = '0010'
down_revision = '0009'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("CREATE TYPE tournamenttype AS ENUM ('freezeout', 'reentry', 'pko')")

    op.add_column('tournaments', sa.Column(
        'tournament_type',
        sa.Enum('freezeout', 'reentry', 'pko', name='tournamenttype'),
        nullable=False, server_default='freezeout',
    ))
    op.add_column('tournaments', sa.Column('min_players', sa.Integer(), nullable=False, server_default='2'))
    op.add_column('tournaments', sa.Column('seats_per_table', sa.Integer(), nullable=False, server_default='6'))
    op.add_column('tournaments', sa.Column('blind_level_minutes', sa.Integer(), nullable=False, server_default='10'))
    op.add_column('tournaments', sa.Column('late_reg_levels', sa.Integer(), nullable=False, server_default='3'))
    op.add_column('tournaments', sa.Column('guaranteed_prize', sa.Numeric(18, 4), nullable=False, server_default='0'))
    op.add_column('tournaments', sa.Column('is_private', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('tournaments', sa.Column('password_hash', sa.String(128), nullable=True))


def downgrade():
    op.drop_column('tournaments', 'password_hash')
    op.drop_column('tournaments', 'is_private')
    op.drop_column('tournaments', 'guaranteed_prize')
    op.drop_column('tournaments', 'late_reg_levels')
    op.drop_column('tournaments', 'blind_level_minutes')
    op.drop_column('tournaments', 'seats_per_table')
    op.drop_column('tournaments', 'min_players')
    op.drop_column('tournaments', 'tournament_type')
    op.execute("DROP TYPE tournamenttype")
