import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { useApi } from '../hooks/useApi'

type Tab = 'rewards' | 'vip' | 'skins'

interface ShopItem {
  id: number
  item_key: string
  name: string
  description: string | null
  item_type: string
  rarity: string
  price: number
  icon: string | null
  owned: boolean
  equipped: boolean
}

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'rewards', label: 'Клубные Награды', icon: '🏆' },
  { key: 'vip',     label: 'VIP',             icon: '👑' },
  { key: 'skins',   label: 'Скины',           icon: '🎨' },
]

const RARITY_STYLE: Record<string, { border: string; label: string; color: string }> = {
  common:    { border: 'rgba(100,100,100,0.3)',  label: 'Обычный',     color: '#9ca3af' },
  rare:      { border: 'rgba(59,130,246,0.3)',   label: 'Редкий',      color: '#60a5fa' },
  epic:      { border: 'rgba(168,85,247,0.3)',   label: 'Эпический',   color: '#c084fc' },
  legendary: { border: 'rgba(212,168,67,0.35)',  label: 'Легендарный', color: '#d4a843' },
}

export default function Shop() {
  const [tab, setTab] = useState<Tab>('rewards')
  const user = useStore((s) => s.user)
  const setUser = useStore((s) => s.setUser)
  const navigate = useNavigate()
  const { get, post } = useApi()

  const [items, setItems] = useState<ShopItem[]>([])
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  useEffect(() => {
    get<ShopItem[]>('/shop/items').then(setItems).catch(() => {})
  }, [])

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  return (
    <div className="min-h-screen pb-24 px-4 pt-5 relative z-10">

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl text-sm font-bold shadow-xl"
            style={{ background: toast.ok ? '#16a34a' : '#dc2626', color: 'white', minWidth: 200, textAlign: 'center' }}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-extrabold tracking-tight">Инвентарь</h1>
        <div className="text-right">
          <div className="text-[10px] text-gray-600">Клубные Активы</div>
          <div className="text-sm font-extrabold text-poker-gold">{(user?.balance ?? 0).toLocaleString()} RR</div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1.5 mb-5 rounded-2xl p-1.5" style={{ background: 'rgba(255,255,255,0.03)' }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all relative"
            style={{ color: tab === t.key ? 'white' : '#6b7280' }}
          >
            {tab === t.key && (
              <motion.div layoutId="shop-tab" className="absolute inset-0 rounded-xl"
                style={{ background: '#1c1c1c', border: '1px solid rgba(255,255,255,0.08)' }} />
            )}
            <span className="relative z-10">{t.icon} {t.label}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {tab === 'rewards' && <ClubRewardsTab key="rewards" onService={() => navigate('/service')} />}
        {tab === 'vip'     && <ItemsTab key="vip"   items={items.filter(i => i.item_type === 'vip')}       onBuy={async (item) => { try { await post('/shop/buy', { item_key: item.item_key }); showToast(`${item.name} активирован!`, true); const d = await get<ShopItem[]>('/shop/items'); setItems(d) } catch { showToast('Недостаточно RR', false) } }} onEquip={async (item) => { try { await post('/shop/equip', { item_key: item.item_key }); const d = await get<ShopItem[]>('/shop/items'); setItems(d) } catch {} }} />}
        {tab === 'skins'   && <ItemsTab key="skins" items={items.filter(i => i.item_type === 'card_skin')} onBuy={async (item) => { try { await post('/shop/buy', { item_key: item.item_key }); showToast(`${item.name} куплен!`, true); const d = await get<ShopItem[]>('/shop/items'); setItems(d) } catch { showToast('Недостаточно RR', false) } }} onEquip={async (item) => { try { await post('/shop/equip', { item_key: item.item_key }); const d = await get<ShopItem[]>('/shop/items'); setItems(d) } catch {} }} />}
      </AnimatePresence>
    </div>
  )
}

// ── Club Rewards info screen (no crypto UI) ───────────────────────────────────

function ClubRewardsTab({ onService }: { onService: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">

      {/* Hero card */}
      <div className="card-ticket p-5 text-center">
        <div className="text-4xl mb-3">♠️</div>
        <h2 className="text-base font-extrabold text-poker-gold mb-2">Клубные Активы (RR)</h2>
        <p className="text-sm text-gray-400 leading-relaxed">
          Используйте клубные активы для участия в турнирах,
          получения доступа к VIP-залам и приобретения
          эксклюзивных привилегий клуба.
        </p>
      </div>

      {/* How to use */}
      <p className="section-title">Как использовать активы</p>
      <div className="space-y-2">
        {[
          { icon: '🏆', title: 'Турниры',       desc: 'Регистрируйтесь в ежедневных и еженедельных турнирах' },
          { icon: '♠️', title: 'VIP-залы',       desc: 'Доступ к столам с высокими ставками' },
          { icon: '🎨', title: 'Скины и рамки',  desc: 'Персонализируйте внешний вид своего профиля' },
          { icon: '👑', title: 'VIP-статус',     desc: 'Активируйте привилегии клуба на сезон' },
        ].map((item) => (
          <div key={item.title} className="card-surface p-3.5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
              style={{ background: 'rgba(212,168,67,0.08)', border: '1px solid rgba(212,168,67,0.15)' }}>
              {item.icon}
            </div>
            <div>
              <div className="text-sm font-bold">{item.title}</div>
              <div className="text-[11px] text-gray-500">{item.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* CTA — redirect to Service page */}
      <button
        onClick={onService}
        className="w-full py-4 rounded-2xl font-bold text-sm transition-all"
        style={{
          background: 'rgba(212,168,67,0.08)',
          border: '1px solid rgba(212,168,67,0.25)',
          color: '#d4a843',
        }}
      >
        Управление активами → Клубный Сервис
      </button>
    </motion.div>
  )
}

// ── Items grid ────────────────────────────────────────────────────────────────

function ItemsTab({ items, onBuy, onEquip }: {
  items: ShopItem[]
  onBuy: (item: ShopItem) => Promise<void>
  onEquip: (item: ShopItem) => Promise<void>
}) {
  const [buying, setBuying] = useState<string | null>(null)

  if (items.length === 0) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center text-gray-600 py-16">
        Нет доступных товаров
      </motion.div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
      {items.map((item, i) => {
        const r = RARITY_STYLE[item.rarity] ?? RARITY_STYLE.common
        return (
          <motion.div key={item.item_key}
            initial={{ x: -12, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: i * 0.04 }}
            className="rounded-2xl p-4"
            style={{ background: '#1c1c1c', border: `1px solid ${r.border}` }}>
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${r.border}` }}>
                {item.icon ?? '🎁'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-bold text-sm">{item.name}</span>
                  <span className="text-[9px] font-bold uppercase" style={{ color: r.color }}>{r.label}</span>
                </div>
                <p className="text-xs text-gray-500">{item.description}</p>
              </div>
              <div className="flex-shrink-0 flex flex-col gap-1.5 items-end">
                {item.owned ? (
                  <>
                    <span className="text-xs font-bold px-2 py-1 rounded-lg"
                      style={{ background: 'rgba(34,197,94,0.1)', color: '#4ade80' }}>Есть</span>
                    {item.item_type !== 'vip' && (
                      <button onClick={() => onEquip(item)}
                        className="text-[10px] px-2 py-1 rounded-lg font-bold"
                        style={item.equipped
                          ? { background: 'rgba(212,168,67,0.15)', color: '#d4a843' }
                          : { background: 'rgba(255,255,255,0.05)', color: '#6b7280' }}>
                        {item.equipped ? 'Надет' : 'Надеть'}
                      </button>
                    )}
                  </>
                ) : (
                  <button
                    onClick={async () => { setBuying(item.item_key); await onBuy(item); setBuying(null) }}
                    disabled={buying === item.item_key}
                    className="btn-gold !py-1.5 !px-3 !text-xs !rounded-lg disabled:opacity-50">
                    {buying === item.item_key ? '...' : item.price === 0 ? 'Бесплатно' : `${item.price} RR`}
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )
      })}
    </motion.div>
  )
}
