import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../store/useStore'
import { useApi } from '../hooks/useApi'
import { ChipBalance } from '../components/ChipBalance'

type Tab = 'vip' | 'skins' | 'emotes' | 'donate'

interface ShopItem {
  id: number
  item_key: string
  name: string
  description: string | null
  item_type: string
  rarity: string
  price: number
  icon: string | null
  vip_days: number
  owned: boolean
  equipped: boolean
  expires_at: string | null
}

const rarityColors: Record<string, string> = {
  common:    'border-gray-600/30 bg-gray-800/20',
  rare:      'border-blue-500/30 bg-blue-900/10',
  epic:      'border-purple-500/30 bg-purple-900/10',
  legendary: 'border-poker-gold/30 bg-yellow-900/10',
}

const rarityLabels: Record<string, { text: string; color: string }> = {
  common:    { text: 'Обычный',    color: 'text-gray-400' },
  rare:      { text: 'Редкий',     color: 'text-blue-400' },
  epic:      { text: 'Эпический',  color: 'text-purple-400' },
  legendary: { text: 'Легендарный', color: 'text-poker-gold' },
}

const tabs: { key: Tab; label: string; icon: string }[] = [
  { key: 'vip',    label: 'VIP',        icon: '👑' },
  { key: 'skins',  label: 'Раскраски',  icon: '🎨' },
  { key: 'emotes', label: 'Эмоции',     icon: '😎' },
  { key: 'donate', label: 'Донат',      icon: '💰' },
]

const TYPE_MAP: Record<Tab, string> = {
  vip:    'vip',
  skins:  'card_skin',
  emotes: 'emote',
  donate: '',
}

export default function Shop() {
  const [tab, setTab] = useState<Tab>('vip')
  const user = useStore((s) => s.user)
  const setUser = useStore((s) => s.setUser)
  const { get, post } = useApi()

  const [items, setItems] = useState<ShopItem[]>([])
  const [loading, setLoading] = useState(true)
  const [buying, setBuying] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  const loadItems = useCallback(async () => {
    setLoading(true)
    try {
      const data = await get<ShopItem[]>('/shop/items')
      setItems(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [get])

  useEffect(() => { loadItems() }, [loadItems])

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 2500)
  }

  const handleBuy = async (item: ShopItem) => {
    if (buying) return
    setBuying(item.item_key)
    try {
      await post('/shop/buy', { item_key: item.item_key })
      showToast(`${item.name} куплен!`, true)
      // Refresh items and balance
      await loadItems()
      const profile = await get<{ balance: number; fun_balance: number }>('/profile/me')
      if (user) setUser({ ...user, balance: profile.balance, fun_balance: profile.fun_balance })
    } catch (e: any) {
      const msg = e?.message?.includes('402') ? 'Недостаточно фишек'
                : e?.message?.includes('409') ? 'Уже куплено'
                : 'Ошибка покупки'
      showToast(msg, false)
    } finally {
      setBuying(null)
    }
  }

  const handleEquip = async (item: ShopItem) => {
    try {
      await post('/shop/equip', { item_key: item.item_key })
      showToast(`${item.name} надет!`, true)
      await loadItems()
    } catch (e) {
      showToast('Ошибка', false)
    }
  }

  const filtered = items.filter((i) => i.item_type === TYPE_MAP[tab])

  return (
    <div className="min-h-screen pb-24 px-4 pt-6">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl text-sm font-bold shadow-lg ${
              toast.ok ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
            }`}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

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
              tab === t.key ? 'text-white' : 'text-gray-500 hover:text-gray-300'
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
        ) : loading ? (
          <div key="loading" className="text-center text-gray-500 py-12">Загрузка...</div>
        ) : (
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-3"
          >
            {filtered.map((item, i) => (
              <motion.div
                key={item.item_key}
                initial={{ x: -16, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: i * 0.04 }}
                className={`card-surface p-4 border ${rarityColors[item.rarity] ?? rarityColors.common} transition-all`}
              >
                <div className="flex items-start gap-3">
                  <div className="text-3xl w-12 h-12 flex items-center justify-center rounded-xl bg-white/[0.03]">
                    {item.icon ?? '🎁'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="font-bold text-sm">{item.name}</h3>
                      <span className={`text-[9px] font-bold uppercase tracking-wider ${rarityLabels[item.rarity]?.color ?? ''}`}>
                        {rarityLabels[item.rarity]?.text}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 leading-relaxed">{item.description}</p>
                    {item.expires_at && (
                      <p className="text-[10px] text-amber-400 mt-1">
                        До: {new Date(item.expires_at).toLocaleDateString('ru')}
                      </p>
                    )}
                  </div>
                  <div className="flex-shrink-0 flex flex-col gap-1.5 items-end">
                    {item.owned ? (
                      <>
                        <span className="text-xs font-bold text-emerald-400 bg-emerald-900/30 px-3 py-1.5 rounded-lg">
                          Есть
                        </span>
                        {item.item_type !== 'vip' && (
                          <button
                            onClick={() => handleEquip(item)}
                            className={`text-[10px] px-2 py-1 rounded-lg font-bold transition-all ${
                              item.equipped
                                ? 'bg-poker-gold/20 text-poker-gold'
                                : 'bg-white/[0.05] text-gray-400 hover:text-white'
                            }`}
                          >
                            {item.equipped ? 'Надет' : 'Надеть'}
                          </button>
                        )}
                      </>
                    ) : (
                      <button
                        onClick={() => handleBuy(item)}
                        disabled={buying === item.item_key}
                        className="btn-gold !py-1.5 !px-3 !text-xs !rounded-lg disabled:opacity-50"
                      >
                        {buying === item.item_key ? '...' : item.price === 0 ? 'Бесплатно' : `${item.price} RR`}
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
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
      <div className="card-surface-glow p-5 mb-4">
        <h3 className="font-bold text-sm mb-2 text-poker-gold">💰 Пополнить баланс</h3>
        <p className="text-xs text-gray-400 leading-relaxed mb-3">
          Покупайте Royal Roll через бота.
          Напишите <span className="text-white font-mono">/buy</span> в чат бота.
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
      <p className="section-title">Как купить</p>
      <div className="space-y-2">
        {[
          { step: '1', text: 'Откройте чат с ботом', sub: '@POKER_VIP_1_Bot' },
          { step: '2', text: 'Напишите /buy',         sub: 'Выберите TON или USDT' },
          { step: '3', text: 'Отправьте оплату',      sub: 'На указанный кошелёк' },
          { step: '4', text: 'RR зачислены!',         sub: 'Автоматически' },
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
