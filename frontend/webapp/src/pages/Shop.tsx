import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { QRCodeSVG } from 'qrcode.react'
import { useStore } from '../store/useStore'
import { useApi } from '../hooks/useApi'

type Tab = 'deposit' | 'withdraw' | 'vip' | 'skins'

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

interface Rates {
  rate_usdt_per_rr: number
  rate_ton_per_rr: number
  rr_per_usdt: number
  rr_per_ton: number
}

interface DepositDetails {
  wallet_address: string
  amount_crypto: number
  currency: string
  comment: string
  qr_data: string
  amount_rr: number
}

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'deposit',  label: 'Пополнить',  icon: '💳' },
  { key: 'withdraw', label: 'Обмен наград', icon: '💸' },
  { key: 'vip',      label: 'VIP',         icon: '👑' },
  { key: 'skins',    label: 'Скины',       icon: '🎨' },
]

const RARITY_STYLE: Record<string, { border: string; label: string; color: string }> = {
  common:    { border: 'rgba(100,100,100,0.3)',  label: 'Обычный',     color: '#9ca3af' },
  rare:      { border: 'rgba(59,130,246,0.3)',   label: 'Редкий',      color: '#60a5fa' },
  epic:      { border: 'rgba(168,85,247,0.3)',   label: 'Эпический',   color: '#c084fc' },
  legendary: { border: 'rgba(212,168,67,0.35)',  label: 'Легендарный', color: '#d4a843' },
}

export default function Shop() {
  const [tab, setTab] = useState<Tab>('deposit')
  const user = useStore((s) => s.user)
  const setUser = useStore((s) => s.setUser)
  const { get, post } = useApi()

  const [rates, setRates] = useState<Rates | null>(null)
  const [items, setItems] = useState<ShopItem[]>([])
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  useEffect(() => {
    get<Rates>('/economy/rates').then(setRates).catch(() => {})
    get<ShopItem[]>('/shop/items').then(setItems).catch(() => {})
  }, [])

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  const refreshBalance = async () => {
    try {
      const bal = await get<{ balance: number; fun_balance: number }>('/economy/balance')
      if (user) setUser({ ...user, balance: bal.balance, fun_balance: bal.fun_balance })
    } catch {}
  }

  return (
    <div className="min-h-screen pb-24 px-4 pt-5 relative z-10">

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
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
          <div className="text-xs text-gray-600">Клубные Активы</div>
          <div className="text-sm font-extrabold text-poker-gold">{(user?.balance ?? 0).toLocaleString()} RR</div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="grid grid-cols-4 gap-1.5 mb-5 rounded-2xl p-1.5" style={{ background: 'rgba(255,255,255,0.03)' }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="py-2 rounded-xl text-[11px] font-bold transition-all relative"
            style={{ color: tab === t.key ? 'white' : '#6b7280' }}
          >
            {tab === t.key && (
              <motion.div layoutId="shop-tab" className="absolute inset-0 rounded-xl"
                style={{ background: '#1c1c1c', border: '1px solid rgba(255,255,255,0.08)' }} />
            )}
            <span className="relative z-10 flex flex-col items-center gap-0.5">
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {tab === 'deposit' && (
          <DepositTab key="deposit" rates={rates} onSuccess={refreshBalance} showToast={showToast} />
        )}
        {tab === 'withdraw' && (
          <WithdrawTab key="withdraw" rates={rates} balance={user?.balance ?? 0} onSuccess={refreshBalance} showToast={showToast} />
        )}
        {(tab === 'vip' || tab === 'skins') && (
          <ItemsTab
            key={tab}
            items={items.filter(i => tab === 'vip' ? i.item_type === 'vip' : i.item_type === 'card_skin')}
            onBuy={async (item) => {
              try {
                await post('/shop/buy', { item_key: item.item_key })
                showToast(`${item.name} куплен!`, true)
                const data = await get<ShopItem[]>('/shop/items')
                setItems(data)
                refreshBalance()
              } catch (e: any) {
                showToast(e?.message?.includes('402') ? 'Недостаточно RR' : 'Ошибка', false)
              }
            }}
            onEquip={async (item) => {
              try {
                await post('/shop/equip', { item_key: item.item_key })
                showToast('Надет!', true)
                const data = await get<ShopItem[]>('/shop/items')
                setItems(data)
              } catch { showToast('Ошибка', false) }
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Deposit Tab ───────────────────────────────────────────────────────────────

function DepositTab({ rates, onSuccess, showToast }: {
  rates: Rates | null
  onSuccess: () => void
  showToast: (m: string, ok: boolean) => void
}) {
  const { post } = useApi()
  const [currency, setCurrency] = useState<'ton' | 'usdt'>('ton')
  const [amountRR, setAmountRR] = useState('')
  const [details, setDetails] = useState<DepositDetails | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  const rate = currency === 'ton' ? (rates?.rate_ton_per_rr ?? 0.01724) : (rates?.rate_usdt_per_rr ?? 0.0227)
  const rr = parseFloat(amountRR) || 0
  const crypto = rr > 0 ? (rr * rate).toFixed(6) : '0'

  const PRESETS = [100, 500, 1000, 5000]

  const handlePay = async () => {
    if (rr < 10) { showToast('Минимум 10 RR', false); return }
    setLoading(true)
    try {
      const d = await post<DepositDetails>('/economy/deposit/init', { amount_rr: rr, currency })
      setDetails(d)
    } catch (e: any) {
      showToast(e?.message || 'Ошибка', false)
    } finally {
      setLoading(false)
    }
  }

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key)
      setTimeout(() => setCopied(null), 2000)
    })
  }

  if (details) {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
        {/* Payment card */}
        <div className="card-ticket p-5">
          <div className="text-center mb-4">
            <div className="text-xs text-gray-600 mb-1">Отсканируйте QR или скопируйте данные</div>
            <div className="text-lg font-extrabold text-poker-gold">{details.amount_rr.toLocaleString()} RR</div>
            <div className="text-sm text-gray-400">= {details.amount_crypto} {details.currency}</div>
          </div>

          {/* QR Code */}
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-2xl" style={{ background: 'white' }}>
              <QRCodeSVG value={details.qr_data} size={160} level="M" />
            </div>
          </div>

          <div className="divider-gold mb-4" />

          {/* Wallet address */}
          <div className="mb-3">
            <div className="text-[10px] text-gray-600 mb-1 uppercase tracking-wider">Адрес кошелька</div>
            <div className="flex items-center gap-2 rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <span className="text-xs font-mono text-gray-300 flex-1 truncate">{details.wallet_address}</span>
              <button onClick={() => copy(details.wallet_address, 'wallet')}
                className="text-[10px] font-bold flex-shrink-0 px-2 py-1 rounded-lg transition-colors"
                style={{ color: copied === 'wallet' ? '#4ade80' : '#d4a843' }}>
                {copied === 'wallet' ? '✓' : 'Копировать'}
              </button>
            </div>
          </div>

          {/* Comment — REQUIRED */}
          <div className="mb-4">
            <div className="text-[10px] mb-1 uppercase tracking-wider font-bold" style={{ color: '#f87171' }}>
              ⚠️ Обязательный комментарий к переводу
            </div>
            <div className="flex items-center gap-2 rounded-xl p-3" style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.2)' }}>
              <span className="text-sm font-mono font-bold text-white flex-1">{details.comment}</span>
              <button onClick={() => copy(details.comment, 'comment')}
                className="text-[10px] font-bold flex-shrink-0 px-2 py-1 rounded-lg transition-colors"
                style={{ color: copied === 'comment' ? '#4ade80' : '#f87171' }}>
                {copied === 'comment' ? '✓' : 'Копировать'}
              </button>
            </div>
            <p className="text-[10px] text-red-400/70 mt-1">
              Без этого комментария зачисление невозможно!
            </p>
          </div>

          <p className="text-[10px] text-gray-600 text-center">
            После перевода баланс пополнится автоматически в течение 1–5 минут.
          </p>
        </div>

        <button onClick={() => setDetails(null)} className="w-full btn-secondary py-3 text-sm">
          ← Назад
        </button>
      </motion.div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
      {/* Currency selector */}
      <div className="grid grid-cols-2 gap-2">
        {(['ton', 'usdt'] as const).map((c) => (
          <button key={c} onClick={() => setCurrency(c)}
            className="py-3 rounded-xl font-bold text-sm transition-all"
            style={currency === c
              ? { background: 'rgba(212,168,67,0.12)', color: '#d4a843', border: '1px solid rgba(212,168,67,0.3)' }
              : { background: 'rgba(255,255,255,0.03)', color: '#6b7280', border: '1px solid rgba(255,255,255,0.06)' }
            }>
            {c === 'ton' ? '🔷 TON' : '💵 USDT'}
          </button>
        ))}
      </div>

      {/* Rate display */}
      <div className="rounded-xl px-4 py-2.5 flex items-center justify-between"
        style={{ background: 'rgba(212,168,67,0.05)', border: '1px solid rgba(212,168,67,0.12)' }}>
        <span className="text-xs text-gray-600">Курс</span>
        <span className="text-xs font-bold text-poker-gold">
          1 RR = {rate} {currency.toUpperCase()}
        </span>
      </div>

      {/* Presets */}
      <div className="grid grid-cols-4 gap-2">
        {PRESETS.map((p) => (
          <button key={p} onClick={() => setAmountRR(String(p))}
            className="py-2 rounded-xl text-xs font-bold transition-all"
            style={amountRR === String(p)
              ? { background: 'rgba(212,168,67,0.15)', color: '#d4a843', border: '1px solid rgba(212,168,67,0.3)' }
              : { background: 'rgba(255,255,255,0.04)', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.06)' }
            }>
            {p.toLocaleString()}
          </button>
        ))}
      </div>

      {/* Amount input */}
      <div>
        <label className="text-[10px] text-gray-600 uppercase tracking-wider mb-1.5 block">Сумма в RR</label>
        <input
          type="number"
          value={amountRR}
          onChange={(e) => setAmountRR(e.target.value)}
          placeholder="Введите сумму RR"
          className="w-full rounded-xl px-4 py-3.5 text-white font-bold text-lg outline-none transition-all"
          style={{ background: '#1c1c1c', border: '1px solid rgba(255,255,255,0.1)' }}
        />
        {rr > 0 && (
          <div className="text-xs text-gray-500 mt-1.5 text-right">
            = <span className="text-poker-gold font-bold">{crypto} {currency.toUpperCase()}</span>
          </div>
        )}
      </div>

      <button
        onClick={handlePay}
        disabled={loading || rr < 10}
        className="w-full btn-gold py-4 text-base disabled:opacity-40"
      >
        {loading ? 'Загрузка...' : `Оплатить ${rr > 0 ? `${crypto} ${currency.toUpperCase()}` : ''}`}
      </button>

      <p className="text-[10px] text-gray-700 text-center">
        Минимум 10 RR · Зачисление автоматически
      </p>
    </motion.div>
  )
}

// ── Withdraw Tab ──────────────────────────────────────────────────────────────

function WithdrawTab({ rates, balance, onSuccess, showToast }: {
  rates: Rates | null
  balance: number
  onSuccess: () => void
  showToast: (m: string, ok: boolean) => void
}) {
  const { post } = useApi()
  const setUser = useStore((s) => s.setUser)
  const user = useStore((s) => s.user)
  const [currency, setCurrency] = useState<'ton' | 'usdt'>('ton')
  const [amountRR, setAmountRR] = useState('')
  const [wallet, setWallet] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState<{ amount_rr: number; amount_crypto: number; currency: string } | null>(null)

  const rate = currency === 'ton' ? (rates?.rate_ton_per_rr ?? 0.01724) : (rates?.rate_usdt_per_rr ?? 0.0227)
  const rr = parseFloat(amountRR) || 0
  const crypto = rr > 0 ? (rr * rate).toFixed(6) : '0'

  const handleOrder = async () => {
    if (rr < 10) { showToast('Минимум 10 RR', false); return }
    if (rr > balance) { showToast('Недостаточно Клубных Активов', false); return }
    if (!wallet.trim()) { showToast('Укажите адрес кошелька', false); return }
    setLoading(true)
    try {
      const res = await post<{ amount_rr: number; amount_crypto: number; currency: string; new_balance: number }>(
        '/economy/withdraw', { amount_rr: rr, currency, wallet_address: wallet.trim() }
      )
      if (user) setUser({ ...user, balance: res.new_balance })
      setDone({ amount_rr: res.amount_rr, amount_crypto: res.amount_crypto, currency: res.currency })
      onSuccess()
    } catch (e: any) {
      const msg = e?.message || ''
      showToast(msg.includes('Недостаточно') ? 'Недостаточно Клубных Активов' : 'Ошибка заявки', false)
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="card-ticket p-6 text-center">
        <div className="text-4xl mb-3">✅</div>
        <h3 className="font-extrabold text-lg mb-1">Заявка принята</h3>
        <p className="text-sm text-gray-400 mb-4">
          {done.amount_rr.toLocaleString()} RR → {done.amount_crypto} {done.currency}
        </p>
        <p className="text-xs text-gray-600 mb-5">
          Обработка до 24 часов. Статус можно отследить в истории транзакций.
        </p>
        <button onClick={() => { setDone(null); setAmountRR(''); setWallet('') }} className="btn-gold px-8 py-2.5 text-sm">
          Новая заявка
        </button>
      </motion.div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
      {/* Balance */}
      <div className="rounded-xl px-4 py-3 flex items-center justify-between"
        style={{ background: 'rgba(212,168,67,0.06)', border: '1px solid rgba(212,168,67,0.15)' }}>
        <span className="text-xs text-gray-500">Доступно к обмену</span>
        <span className="font-bold text-poker-gold">{balance.toLocaleString()} RR</span>
      </div>

      {/* Currency */}
      <div className="grid grid-cols-2 gap-2">
        {(['ton', 'usdt'] as const).map((c) => (
          <button key={c} onClick={() => setCurrency(c)}
            className="py-3 rounded-xl font-bold text-sm transition-all"
            style={currency === c
              ? { background: 'rgba(212,168,67,0.12)', color: '#d4a843', border: '1px solid rgba(212,168,67,0.3)' }
              : { background: 'rgba(255,255,255,0.03)', color: '#6b7280', border: '1px solid rgba(255,255,255,0.06)' }
            }>
            {c === 'ton' ? '🔷 TON' : '💵 USDT'}
          </button>
        ))}
      </div>

      {/* Amount */}
      <div>
        <label className="text-[10px] text-gray-600 uppercase tracking-wider mb-1.5 block">Сумма в RR</label>
        <input
          type="number"
          value={amountRR}
          onChange={(e) => setAmountRR(e.target.value)}
          placeholder="Введите сумму RR"
          className="w-full rounded-xl px-4 py-3.5 text-white font-bold text-lg outline-none"
          style={{ background: '#1c1c1c', border: '1px solid rgba(255,255,255,0.1)' }}
        />
        {rr > 0 && (
          <div className="text-xs text-gray-500 mt-1.5 flex justify-between">
            <span className={rr > balance ? 'text-red-400' : 'text-gray-600'}>
              {rr > balance ? '⚠️ Превышает баланс' : ''}
            </span>
            <span>= <span className="text-poker-gold font-bold">{crypto} {currency.toUpperCase()}</span></span>
          </div>
        )}
      </div>

      {/* Wallet address */}
      <div>
        <label className="text-[10px] text-gray-600 uppercase tracking-wider mb-1.5 block">
          Ваш {currency.toUpperCase()} адрес
        </label>
        <input
          type="text"
          value={wallet}
          onChange={(e) => setWallet(e.target.value)}
          placeholder={currency === 'ton' ? 'UQ...' : 'T...'}
          className="w-full rounded-xl px-4 py-3 text-white font-mono text-sm outline-none"
          style={{ background: '#1c1c1c', border: '1px solid rgba(255,255,255,0.1)' }}
        />
      </div>

      <button
        onClick={handleOrder}
        disabled={loading || rr < 10 || rr > balance || !wallet.trim()}
        className="w-full btn-gold py-4 text-base disabled:opacity-40"
      >
        {loading ? 'Отправка...' : 'ЗАКАЗАТЬ ОБМЕН'}
      </button>

      <p className="text-[10px] text-gray-700 text-center">
        Баланс списывается сразу · Выплата до 24 ч · Мин. 10 RR
      </p>
    </motion.div>
  )
}

// ── Items Tab ─────────────────────────────────────────────────────────────────

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
