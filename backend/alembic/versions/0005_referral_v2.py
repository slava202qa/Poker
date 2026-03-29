"""referral v2: welcome bonus, referrer bonus on deposit, anti-fraud ip hash"""
from alembic import op
import sqlalchemy as sa

revision = '0005'
down_revision = '0004'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('referrals', sa.Column('referrer_bonus', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('referrals', sa.Column('referrer_bonus_paid', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('referrals', sa.Column('welcome_bonus', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('referrals', sa.Column('welcome_bonus_paid', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('referrals', sa.Column('referred_ip_hash', sa.String(64), nullable=True))
    # Remove old bonus_paid column
    op.drop_column('referrals', 'bonus_paid')


def downgrade():
    op.add_column('referrals', sa.Column('bonus_paid', sa.Integer(), nullable=False, server_default='0'))
    op.drop_column('referrals', 'referrer_bonus')
    op.drop_column('referrals', 'referrer_bonus_paid')
    op.drop_column('referrals', 'welcome_bonus')
    op.drop_column('referrals', 'welcome_bonus_paid')
    op.drop_column('referrals', 'referred_ip_hash')
