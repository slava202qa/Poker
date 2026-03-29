"""add clan chat and weekly scores tables"""
from alembic import op
import sqlalchemy as sa

revision = '0007'
down_revision = '0006'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'clan_messages',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('clan_id', sa.Integer(), sa.ForeignKey('clans.id'), nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('text', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_clan_messages_clan_id', 'clan_messages', ['clan_id'])

    op.create_table(
        'clan_weekly_scores',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('clan_id', sa.Integer(), sa.ForeignKey('clans.id'), nullable=False),
        sa.Column('week_start', sa.DateTime(timezone=True), nullable=False),
        sa.Column('total_winnings', sa.Numeric(18, 4), server_default='0'),
        sa.Column('hands_played', sa.Integer(), server_default='0'),
    )
    op.create_index('ix_clan_weekly_scores_clan_id', 'clan_weekly_scores', ['clan_id'])


def downgrade():
    op.drop_table('clan_messages')
    op.drop_table('clan_weekly_scores')
