import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../store/useStore'
import { ChipBalance } from '../components/ChipBalance'

type Tab = 'vip' | 'skins' | 'emotes' | 'donate'

interface ShopItem {
  id: string
  name: string
  description: string
  price: number
  currency: 'rr' | 'free'
  icon: string
  owned?: boolean
  rarity?: 'common' | 'rare' | 'epic' | 'legendary'
}

const vipItems: ShopItem[] = [
  { id: 'vip_week', name: 'VIP — 7 дней', description: 'Золотая рамка, приоритет за столами, +5% к бонусам', price: 500, currency: 'rr', icon: '👑', rarity: 'rare' },
  { id: 'vip_month', name: 'VIP — 30 дней', description: 'Всё из VIP 7 + уникальный эмоут + статистика', price: 1500, currency: 'rr', icon: '💎', rarity: 'epic' },
  { id: 'vip_forever', name: 'VIP — Навсегда', description: 'Все привилегии навсегда + эксклюзивная раскраска', price: 5000, currency: 'rr', icon: '🏆', rarity: 'legendary' },
]

const skinItems: ShopItem[] = [
  { id: 'skin_classic', name: 'Классика', description: 'Стандартная колода', price: 0, currency: 'free', icon: '🃏', owned: true, rarity: 'common' },
  { id: 'skin_neon', name: 'Неон', description: 'Светящиеся карты в стиле киберпанк', price: 300, currency: 'rr', icon: '💜', rarity: 'rare' },
  { id: 'skin_gold', name: 'Золотая колода', description: 'Премиальные золотые карты', price: 800, currency: 'rr', icon: '✨', rarity: 'epic' },
  { id: 'skin_diamond', name: 'Бриллиант', description: 'Анимированные карты с частицами', price: 2000, currency: 'rr', icon: '💠', rarity: 'legendary' },
  { id: 'skin_fire', name: 'Огненная', description: 'Карты с эффектом пламени', price: 1200, currency: 'rr', icon: '🔥', rarity: 'epic' },
  { id: 'skin_ice', name: 'Ледяная', description: 'Морозные карты с кристаллами', price: 1200, currency: 'rr', icon: '❄️', rarity: 'epic' },
]

const emoteItems: ShopItem[] = [
  { id: 'emote_gg', name: 'GG', description: 'Хорошая игра!', price: 0, currency: 'free', icon: '👏', owned: true, rarity: 'common' },
  { id: 'emote_bluff', name: 'Блеф', description: 'Покерфейс', price: 100, currency: 'rr', icon: '😏', rarity: 'common' },
  { id: 'emote_rage', name: 'Тильт', description: 'Когда бэд бит', price: 150, currency: 'rr', icon: '🤬', rarity: 'rare' },
  { id: 'emote_money', name: 'Деньги', description: 'Дождь из монет', price: 200, currency: 'rr', icon: '🤑', rarity: 'rare' },
  { id: 'emote_crown', name: 'Корона', description: 'Я тут главный', price: 500, currency: 'rr', icon: '👑', rarity: 'epic' },
  { id: 'emote_rocket', name: 'Ракета', description: 'To the moon!', price: 300, currency: 'rr', icon: '🚀', rarity: 'rare' },
]

const rarityColors: Record<string, string> = {
  common: 'border-gray-600/30 bg-gray-800/20',
  rare: 'border-blue-500/30 bg-blue-900/10',
  epic: 'border-purple-500/30 bg-purple-900/10',
  legendary: 'border-poker-gold/30 bg-yellow-900/10',
}

const rarityLabels: Record<string, { text: string; color: string }> = {
  common: { text: 'Обычный', color: 'text-gray-400' },
  rare: { text: 'Редкий', color: 'text-blue-400' },
  epic: { text: 'Эпический', color: 'text-purple-400' },
  legendary: { text: 'Легендарный', color: 'text-poker-gold' },
}

const tabs: { key: Tab; label: string; icon: string }[] = [
  { key: 'vip', label: 'VIP', icon: '👑' },
  { key: 'skins', label: 'Раскраски', icon: '🎨' },
  { key: 'emotes', label: 'Эмоции', icon: '😎' },
  { key: 'donate', label: 'Донат', icon: '💰' },
]

export default function Shop() {
  const [tab, setTab] = useState<Tab>('vip')
  const user = useStore((s) => s.user)

  const items = tab === 'vip' ? vipItems : tab === 'skins' ? skinItems : emoteItems

  return (
    <div className="min-h-screen pb-24 px-4 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-extrabold">
          <span className="text-poker-gold">🛍</span> Сумка
        </h1>
        <ChipBalance amount={user?.balance ?? 0} currency="chip" size="sm" />
      </div>

      {/* Tab bar */}
      <div className="flex gap-1.5 mb-5 bg-poker-darker/50 rounded-2xl p-1.5">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all relative ${
              tab === t.key
                ? 'text-white'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {tab === t.key && (
              <motion.div
                layoutId="shop-tab"
                className="absolute inset-0 bg-poker-card border border-white/[0.08] rounded-xl"
                style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.3)' }}
              />
            )}
            <span className="relative z-10">{t.icon} {t.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {tab === 'donate' ? (
          <DonateSection key="donate" />
        ) : (
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-3"
          >
            {items.map((item, i) => (
              <motion.div
                key={item.id}
                initial={{ x: -16, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: i * 0.04 }}
                className={`card-surface p-4 border ${rarityColors[item.rarity || 'common']} transition-all`}
              >
                <div className="flex items-start gap-3">
                  <div className="text-3xl w-12 h-12 flex items-center justify-center rounded-xl bg-white/[0.03]">
                    {item.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="font-bold text-sm">{item.name}</h3>
                      {item.rarity && (
                        <span className={`text-[9px] font-bold uppercase tracking-wider ${rarityLabels[item.rarity].color}`}>
                          {rarityLabels[item.rarity].text}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 leading-relaxed">{item.description}</p>
                  </div>
                  <div className="flex-shrink-0">
                    {item.owned ? (
                      <span className="text-xs font-bold text-emerald-400 bg-emerald-900/30 px-3 py-1.5 rounded-lg">
                        Есть
                      </span>
                    ) : (
                      <button className="btn-gold !py-1.5 !px-3 !text-xs !rounded-lg">
                        {item.price} RR
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}


function DonateSection() {
  const donateAmounts = [
    { rr: 100, ton: '1.82', usdt: '2.38' },
    { rr: 500, ton: '9.09', usdt: '11.90' },
    { rr: 1000, ton: '18.18', usdt: '23.81' },
    { rr: 5000, ton: '90.91', usdt: '119.05' },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
    >
      {/* Info card */}
      <div className="card-surface-glow p-5 mb-4">
        <h3 className="font-bold text-sm mb-2 text-poker-gold">💰 Купить Royal Roll</h3>
        <p className="text-xs text-gray-400 leading-relaxed mb-3">
          Покупайте и продавайте RR через бота.
          Напишите <span className="text-white font-mono">/buy</span> или <span className="text-white font-mono">/sell</span> в чат бота.
        </p>
        <div className="flex gap-3 text-xs">
          <div className="flex-1 bg-white/[0.03] rounded-xl p-3 text-center">
            <div className="text-gray-500 mb-1">1 TON</div>
            <div className="font-bold text-poker-gold text-lg">55 RR</div>
          </div>
          <div className="flex-1 bg-white/[0.03] rounded-xl p-3 text-center">
            <div className="text-gray-500 mb-1">1 USDT</div>
            <div className="font-bold text-poker-gold text-lg">42 RR</div>
          </div>
        </div>
      </div>

      {/* Quick amounts */}
      <p className="section-title">Популярные суммы</p>
      <div className="grid grid-cols-2 gap-3 mb-4">
        {donateAmounts.map((d) => (
          <div key={d.rr} className="card-surface p-4 text-center">
            <div className="text-2xl font-extrabold text-poker-gold mb-1">{d.rr.toLocaleString()}</div>
            <div className="text-[10px] text-gray-500 font-medium">ROYAL ROLL</div>
            <div className="mt-2 text-xs text-gray-400">
              ≈ {d.ton} TON / {d.usdt} USDT
            </div>
          </div>
        ))}
      </div>

      {/* How to */}
      <p className="section-title">Как купить</p>
      <div className="space-y-2">
        {[
          { step: '1', text: 'Откройте чат с ботом', sub: '@POKER_VIP_1_Bot' },
          { step: '2', text: 'Напишите /buy', sub: 'Выберите TON или USDT' },
          { step: '3', text: 'Отправьте оплату', sub: 'На указанный кошелёк' },
          { step: '4', text: 'RR зачислены!', sub: 'Автоматически' },
        ].map((s) => (
          <div key={s.step} className="flex items-center gap-3 card-surface p-3">
            <div className="w-8 h-8 rounded-full bg-poker-gold/10 text-poker-gold font-bold text-sm flex items-center justify-center flex-shrink-0">
              {s.step}
            </div>
            <div>
              <div className="text-sm font-medium">{s.text}</div>
              <div className="text-[11px] text-gray-500">{s.sub}</div>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  )
}
