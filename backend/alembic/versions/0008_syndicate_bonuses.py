"""Syndicate bonus fields: bonus_balance on Balance, first_deposit_bonus_paid on Referral,
new TxType values for syndicate_rake and syndicate_claim.

Revision ID: 0008
Revises: 0007
"""
from alembic import op
import sqlalchemy as sa

revision = '0008'
down_revision = '0007'
branch_labels = None
depends_on = None


def upgrade():
    # Add bonus_balance to balances
    op.add_column('balances', sa.Column('bonus_balance', sa.Numeric(18, 4), nullable=False, server_default='0'))

    # Add first_deposit_bonus_paid to referrals
    op.add_column('referrals', sa.Column('first_deposit_bonus_paid', sa.Boolean(), nullable=False, server_default='false'))

    # Extend TxType enum with new values
    op.execute("ALTER TYPE txtype ADD VALUE IF NOT EXISTS 'syndicate_rake'")
    op.execute("ALTER TYPE txtype ADD VALUE IF NOT EXISTS 'syndicate_claim'")


def downgrade():
    op.drop_column('referrals', 'first_deposit_bonus_paid')
    op.drop_column('balances', 'bonus_balance')
