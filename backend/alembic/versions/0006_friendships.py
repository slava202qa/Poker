"""add friendships table"""
from alembic import op
import sqlalchemy as sa

revision = '0006'
down_revision = '0005'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'friendships',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('requester_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('addressee_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('status', sa.String(16), nullable=False, server_default='pending'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_friendships_requester_id', 'friendships', ['requester_id'])
    op.create_index('ix_friendships_addressee_id', 'friendships', ['addressee_id'])


def downgrade():
    op.drop_table('friendships')
