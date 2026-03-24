"""Initial schema: all tables

Revision ID: 0001
Revises:
Create Date: 2025-01-01 00:00:00
"""
from alembic import op
import sqlalchemy as sa

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── users ──────────────────────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("telegram_id", sa.BigInteger(), nullable=False),
        sa.Column("username", sa.String(64), nullable=True),
        sa.Column("first_name", sa.String(128), nullable=False, server_default=""),
        sa.Column("avatar_url", sa.String(512), nullable=True),
        sa.Column("ton_wallet", sa.String(128), nullable=True),
        sa.Column("is_banned", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("last_seen", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_users_telegram_id", "users", ["telegram_id"], unique=True)
    op.create_index("ix_users_ton_wallet", "users", ["ton_wallet"])

    # ── balances ───────────────────────────────────────────────────────────
    op.create_table(
        "balances",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("amount", sa.Numeric(18, 4), nullable=False, server_default="0"),
        sa.Column("fun_amount", sa.Numeric(18, 4), nullable=False, server_default="10000"),
        sa.Column("fun_last_refill", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_balances_user_id", "balances", ["user_id"], unique=True)

    # ── transactions ───────────────────────────────────────────────────────
    op.create_table(
        "transactions",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column(
            "currency",
            sa.Enum("chip", "fun", name="currencytype"),
            nullable=False,
            server_default="chip",
        ),
        sa.Column(
            "tx_type",
            sa.Enum(
                "deposit", "withdraw", "buy_in", "cash_out", "rake",
                "tournament_entry", "tournament_prize", "bonus", "fun_refill",
                "shop_purchase",
                name="txtype",
            ),
            nullable=False,
        ),
        sa.Column("amount", sa.Numeric(18, 4), nullable=False),
        sa.Column("balance_after", sa.Numeric(18, 4), nullable=False),
        sa.Column("reference", sa.String(256), nullable=True),
        sa.Column("ton_tx_hash", sa.String(128), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_transactions_user_id", "transactions", ["user_id"])

    # ── poker_tables ───────────────────────────────────────────────────────
    op.create_table(
        "poker_tables",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(64), nullable=False),
        sa.Column(
            "currency",
            sa.Enum("chip", "fun", name="currencytype"),
            nullable=False,
            server_default="chip",
        ),
        sa.Column("max_players", sa.Integer(), nullable=False, server_default="9"),
        sa.Column("small_blind", sa.Numeric(18, 4), nullable=False),
        sa.Column("big_blind", sa.Numeric(18, 4), nullable=False),
        sa.Column("min_buy_in", sa.Numeric(18, 4), nullable=False),
        sa.Column("max_buy_in", sa.Numeric(18, 4), nullable=False),
        sa.Column(
            "status",
            sa.Enum("waiting", "playing", "paused", name="tablestatus"),
            nullable=False,
            server_default="waiting",
        ),
        sa.Column("current_players", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── table_players ──────────────────────────────────────────────────────
    op.create_table(
        "table_players",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("table_id", sa.Integer(), sa.ForeignKey("poker_tables.id"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("seat", sa.Integer(), nullable=False),
        sa.Column("stack", sa.Numeric(18, 4), nullable=False, server_default="0"),
        sa.Column("is_sitting_out", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("joined_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_table_players_table_id", "table_players", ["table_id"])
    op.create_index("ix_table_players_user_id", "table_players", ["user_id"])

    # ── tournaments ────────────────────────────────────────────────────────
    op.create_table(
        "tournaments",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("buy_in", sa.Numeric(18, 4), nullable=False),
        sa.Column("fee", sa.Numeric(18, 4), nullable=False),
        sa.Column("starting_stack", sa.Numeric(18, 4), nullable=False),
        sa.Column("max_players", sa.Integer(), nullable=False, server_default="100"),
        sa.Column("current_players", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("prize_pool", sa.Numeric(18, 4), nullable=False, server_default="0"),
        sa.Column(
            "status",
            sa.Enum("registering", "running", "finished", "cancelled", name="tournamentstatus"),
            nullable=False,
            server_default="registering",
        ),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── tournament_players ─────────────────────────────────────────────────
    op.create_table(
        "tournament_players",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("tournament_id", sa.Integer(), sa.ForeignKey("tournaments.id"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("finish_position", sa.Integer(), nullable=True),
        sa.Column("prize_won", sa.Numeric(18, 4), nullable=False, server_default="0"),
        sa.Column("registered_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        # Tournament stack (separate from cash balance)
        sa.Column("tournament_stack", sa.Numeric(18, 4), nullable=False, server_default="0"),
        sa.Column("is_eliminated", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("table_id", sa.Integer(), nullable=True),
        sa.Column("seat", sa.Integer(), nullable=True),
    )
    op.create_index("ix_tournament_players_tournament_id", "tournament_players", ["tournament_id"])
    op.create_index("ix_tournament_players_user_id", "tournament_players", ["user_id"])

    # ── shop_items ─────────────────────────────────────────────────────────
    op.create_table(
        "shop_items",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("item_key", sa.String(64), nullable=False),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "item_type",
            sa.Enum("card_skin", "avatar_frame", "emote", "vip", name="itemtype"),
            nullable=False,
        ),
        sa.Column(
            "rarity",
            sa.Enum("common", "rare", "epic", "legendary", name="itemrarity"),
            nullable=False,
            server_default="common",
        ),
        sa.Column("price", sa.Numeric(18, 4), nullable=False, server_default="0"),
        sa.Column("icon", sa.String(16), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("vip_days", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_shop_items_item_key", "shop_items", ["item_key"], unique=True)

    # ── user_inventory ─────────────────────────────────────────────────────
    op.create_table(
        "user_inventory",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("item_id", sa.Integer(), sa.ForeignKey("shop_items.id"), nullable=False),
        sa.Column("is_equipped", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("purchased_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_user_inventory_user_id", "user_inventory", ["user_id"])

    # ── player_stats ───────────────────────────────────────────────────────
    op.create_table(
        "player_stats",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("hands_played", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("hands_won", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("hands_won_no_showdown", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("all_ins_won", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("tournaments_played", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("tournaments_won", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("biggest_pot_won", sa.Numeric(18, 4), nullable=False, server_default="0"),
        sa.Column("total_chips_won", sa.Numeric(18, 4), nullable=False, server_default="0"),
        sa.Column("best_hand", sa.String(32), nullable=True),
        sa.Column("xp", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("level", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("login_streak", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_login_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_player_stats_user_id", "player_stats", ["user_id"], unique=True)

    # ── achievements ───────────────────────────────────────────────────────
    op.create_table(
        "achievements",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("key", sa.String(64), nullable=False),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("icon", sa.String(16), nullable=True),
        sa.Column("rarity", sa.String(16), nullable=False, server_default="bronze"),
        sa.Column("target", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("xp_reward", sa.Integer(), nullable=False, server_default="50"),
    )
    op.create_index("ix_achievements_key", "achievements", ["key"], unique=True)

    # ── user_achievements ──────────────────────────────────────────────────
    op.create_table(
        "user_achievements",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("achievement_id", sa.Integer(), sa.ForeignKey("achievements.id"), nullable=False),
        sa.Column("progress", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("unlocked", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("unlocked_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_user_achievements_user_id", "user_achievements", ["user_id"])

    # ── clans ──────────────────────────────────────────────────────────────
    op.create_table(
        "clans",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(64), nullable=False),
        sa.Column("tag", sa.String(8), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("icon", sa.String(16), nullable=True),
        sa.Column("owner_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("creation_cost", sa.Numeric(18, 4), nullable=False, server_default="0"),
        sa.Column("xp_multiplier", sa.Numeric(4, 2), nullable=False, server_default="1.0"),
        sa.Column("total_xp", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("member_count", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("max_members", sa.Integer(), nullable=False, server_default="50"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_clans_name", "clans", ["name"], unique=True)
    op.create_index("ix_clans_tag", "clans", ["tag"], unique=True)

    # ── clan_members ───────────────────────────────────────────────────────
    op.create_table(
        "clan_members",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("clan_id", sa.Integer(), sa.ForeignKey("clans.id"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column(
            "role",
            sa.Enum("owner", "officer", "member", name="clanrole"),
            nullable=False,
            server_default="member",
        ),
        sa.Column("contribution_xp", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("joined_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_clan_members_clan_id", "clan_members", ["clan_id"])
    op.create_index("ix_clan_members_user_id", "clan_members", ["user_id"])

    # ── seed: default shop items ───────────────────────────────────────────
    op.execute("""
        INSERT INTO shop_items (item_key, name, description, item_type, rarity, price, icon, is_active, vip_days)
        VALUES
          ('skin_classic',  'Классика',       'Стандартная колода',                    'card_skin',    'common',    0,    '🃏', true, 0),
          ('skin_neon',     'Неон',           'Светящиеся карты в стиле киберпанк',    'card_skin',    'rare',    300,    '💜', true, 0),
          ('skin_gold',     'Золотая колода', 'Премиальные золотые карты',             'card_skin',    'epic',    800,    '✨', true, 0),
          ('skin_diamond',  'Бриллиант',      'Анимированные карты с частицами',       'card_skin',    'legendary',2000, '💠', true, 0),
          ('skin_fire',     'Огненная',       'Карты с эффектом пламени',              'card_skin',    'epic',   1200,   '🔥', true, 0),
          ('skin_ice',      'Ледяная',        'Морозные карты с кристаллами',          'card_skin',    'epic',   1200,   '❄️', true, 0),
          ('emote_gg',      'GG',             'Хорошая игра!',                         'emote',        'common',    0,   '👏', true, 0),
          ('emote_bluff',   'Блеф',           'Покерфейс',                             'emote',        'common',  100,   '😏', true, 0),
          ('emote_rage',    'Тильт',          'Когда бэд бит',                         'emote',        'rare',    150,   '🤬', true, 0),
          ('emote_money',   'Деньги',         'Дождь из монет',                        'emote',        'rare',    200,   '🤑', true, 0),
          ('emote_crown',   'Корона',         'Я тут главный',                         'emote',        'epic',    500,   '👑', true, 0),
          ('emote_rocket',  'Ракета',         'To the moon!',                          'emote',        'rare',    300,   '🚀', true, 0),
          ('vip_week',      'VIP — 7 дней',   'Золотая рамка, +5% к бонусам',         'vip',          'rare',    500,   '👑', true, 7),
          ('vip_month',     'VIP — 30 дней',  'Всё из VIP 7 + уникальный эмоут',      'vip',          'epic',   1500,   '💎', true, 30),
          ('vip_forever',   'VIP — Навсегда', 'Все привилегии навсегда',               'vip',          'legendary',5000, '🏆', true, 0)
    """)

    # ── seed: achievements ─────────────────────────────────────────────────
    op.execute("""
        INSERT INTO achievements (key, name, description, icon, rarity, target, xp_reward)
        VALUES
          ('first_hand',      'Первая раздача',   'Сыграйте первую руку',              '🃏', 'bronze',    1,  25),
          ('first_win',       'Первая победа',    'Выиграйте раздачу',                 '🏆', 'bronze',    1,  50),
          ('hands_10',        'Новичок',          'Сыграйте 10 рук',                   '🎯', 'bronze',   10,  50),
          ('hands_100',       'Сотня',            'Сыграйте 100 рук',                  '🎯', 'silver',  100, 150),
          ('hands_1000',      'Тысячник',         'Сыграйте 1000 рук',                 '⚡', 'gold',   1000, 500),
          ('royal_flush',     'Роял Флеш',        'Соберите Royal Flush',              '👑', 'diamond',   1, 1000),
          ('bluff_master',    'Мастер блефа',     'Выиграйте 10 рук без шоудауна',     '😏', 'silver',   10, 200),
          ('big_pot',         'Большой банк',     'Выиграйте банк 10000+ CHIP',        '💰', 'gold',      1, 300),
          ('tournament_win',  'Чемпион',          'Выиграйте турнир',                  '🏅', 'gold',      1, 500),
          ('all_in_win',      'Ва-банк!',         'Выиграйте 5 олл-инов',              '🔥', 'silver',    5, 200),
          ('streak_5',        'Серия побед',      'Выиграйте 5 рук подряд',            '⭐', 'gold',      1, 300),
          ('login_7',         'Неделя',           'Заходите 7 дней подряд',            '📅', 'silver',    7, 150),
          ('login_30',        'Месяц',            'Заходите 30 дней подряд',           '🗓', 'gold',     30, 500)
    """)


def downgrade() -> None:
    op.drop_table("clan_members")
    op.drop_table("clans")
    op.drop_table("user_achievements")
    op.drop_table("achievements")
    op.drop_table("player_stats")
    op.drop_table("user_inventory")
    op.drop_table("shop_items")
    op.drop_table("tournament_players")
    op.drop_table("tournaments")
    op.drop_table("table_players")
    op.drop_table("poker_tables")
    op.drop_table("transactions")
    op.drop_table("balances")
    op.drop_table("users")
    op.execute("DROP TYPE IF EXISTS clanrole")
    op.execute("DROP TYPE IF EXISTS itemrarity")
    op.execute("DROP TYPE IF EXISTS itemtype")
    op.execute("DROP TYPE IF EXISTS tournamentstatus")
    op.execute("DROP TYPE IF EXISTS tablestatus")
    op.execute("DROP TYPE IF EXISTS txtype")
    op.execute("DROP TYPE IF EXISTS currencytype")
