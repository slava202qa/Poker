"""hand_history table

Revision ID: 0013
Revises: 0012
Create Date: 2025-01-01
"""
from alembic import op
import sqlalchemy as sa

revision = '0013'
down_revision = '0012'
branch_labels = None
depends_on = None


def upgrade():
    # Use IF NOT EXISTS so re-running is safe (e.g. after manual stamp)
    op.execute("""
        CREATE TABLE IF NOT EXISTS hand_history (
            id SERIAL PRIMARY KEY,
            table_id INTEGER REFERENCES poker_tables(id) ON DELETE SET NULL,
            table_name VARCHAR(64),
            pot NUMERIC(18,4) DEFAULT 0,
            rake NUMERIC(18,4) DEFAULT 0,
            winners_json TEXT DEFAULT '[]',
            community_cards_json TEXT DEFAULT '[]',
            poker_type VARCHAR(16) DEFAULT 'HOLDEM',
            player_count INTEGER DEFAULT 0,
            finished_at TIMESTAMPTZ DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_hand_history_table_id ON hand_history(table_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_hand_history_finished_at ON hand_history(finished_at)")


def downgrade():
    op.execute("DROP TABLE IF EXISTS hand_history")
