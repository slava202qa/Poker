import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTonAddress, useTonConnectUI } from '@tonconnect/ui-react'
import { useSearchParams } from 'react-router-dom'
import { useApi } from '../hooks/useApi'
import { useStore } from '../store/useStore'

type Tab = 'buy' | 'exchange'

interface Rates {
  rate_ton_per_rr: number
  rr_per_ton: number
}

interface DepositInit {
  wallet_address: string
  amount_crypto: number
  currency: string
  comment: string
  qr_data: string
  amount_rr: number
}

export default function Deposit() {
  const [searchParams] = useSearchParams()
  const initialTab = (searchParams.get('tab') as Tab) || 'buy'
  const [tab, setTab] = useState<Tab>(initialTab)
  const [amountRR, setAmountRR] = useState(1000)
  const [rates, setRates] = useState<Rates | null>(null)
  const [depositInfo, setDepositInfo] = useState<DepositInit | null>(null)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  // Withdraw state
  const [withdrawAmount, setWithdrawAmount] = useState(1000)
  const [withdrawWallet, setWithdrawWallet] = useState('')
  const [withdrawing, setWithdrawing] = useState(false)

  const api = useApi()
  const user = useStore((s) => s.user)
  const setUser = useStore((s) => s.setUser)
  const address = useTonAddress()
  const [tonConnectUI] = useTonConnectUI()

  useEffect(() => {
    api.get<Rates>('/economy/rates').then(setRates).catch(() => {})
  }, [])

  // Pre-fill wallet from connected address
  useEffect(() => {
    if (address && !withdrawWallet) setWithdrawWallet(address)
  }, [address])

  function showMsg(text: string, ok: boolean) {
    setMsg({ text, ok })
    setTimeout(() => setMsg(null), 4000)
  }

  async function handleInitDeposit() {
    if (amountRR < 10) return showMsg('Минимум 10 RR', false)
    setLoading(true)
    setDepositInfo(null)
    try {
      const info = await api.post<DepositInit>('/economy/deposit/init', {
        amount_rr: amountRR,
        currency: 'ton',
      })
      setDepositInfo(info)
    } catch (e: any) {
      showMsg(e?.detail || 'Ошибка инициализации', false)
    } finally {
      setLoading(false)
    }
  }

  async function handleSendTon() {
    if (!depositInfo || !address) return
    setSending(true)
    try {
      const nanotons = Math.ceil(depositInfo.amount_crypto * 1_000_000_000)
      await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 600,
        messages: [
          {
            address: depositInfo.wallet_address,
            amount: String(nanotons),
            payload: btoa(depositInfo.comment),
          },
        ],
      })
      showMsg('Транзакция отправлена! Баланс обновится через ~30 сек.', true)
      setDepositInfo(null)
    } catch (e: any) {
      if (String(e).includes('User rejects')) {
        showMsg('Отменено', false)
      } else {
        showMsg('Ошибка отправки', false)
      }
    } finally {
      setSending(false)
    }
  }

  async function handleWithdraw() {
    if (withdrawAmount < 10) return showMsg('Минимум 10 RR', false)
    if (!withdrawWallet.trim()) return showMsg('Укажите адрес кошелька', false)
    setWithdrawing(true)
    try {
      const res = await api.post<{ new_balance: number }>('/economy/withdraw', {
        amount_rr: withdrawAmount,
        currency: 'ton',
        wallet_address: withdrawWallet.trim(),
      })
      if (user) setUser({ ...user, balance: res.new_balance })
      showMsg('Заявка на вывод создана. Обработка до 24 часов.', true)
      setWithdrawAmount(1000)
    } catch (e: any) {
      showMsg(e?.detail || 'Ошибка вывода', false)
    } finally {
      setWithdrawing(false)
    }
  }

  const tonAmount = rates ? (amountRR * rates.rate_ton_per_rr).toFixed(4) : '...'
  const balance = user?.balance ?? 0

  return (
    <div className="min-h-screen pb-24 px-4 pt-5">

      {/* Toast */}
      <AnimatePresence>
        {msg && (
          <motion.div
            initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-xl text-sm font-bold shadow-xl text-center"
            style={{ background: msg.ok ? '#16a34a' : '#dc2626', color: 'white', minWidth: 240 }}
          >
            {msg.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <motion.div initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="mb-5">
        <h1 className="text-xl font-extrabold tracking-tight">Клубный Сервис</h1>
        <p className="text-xs text-gray-600 mt-1">Баланс: <span className="text-poker-gold font-bold">{balance.toLocaleString()} RR</span></p>
      </motion.div>

      {/* Wallet connect */}
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl p-4 mb-5 flex items-center justify-between"
        style={{ background: '#1c1c1c', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div>
          <p className="text-xs text-gray-500 mb-0.5">TON Кошелёк</p>
          {address
            ? <p className="text-xs font-mono text-green-400">{address.slice(0, 8)}...{address.slice(-6)}</p>
            : <p className="text-xs text-gray-600">Не подключён</p>
          }
        </div>
        <button
          onClick={() => address ? tonConnectUI.disconnect() : tonConnectUI.openModal()}
          className="px-4 py-2 rounded-xl text-xs font-bold transition-all"
          style={address
            ? { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171' }
            : { background: 'rgba(212,168,67,0.1)', border: '1px solid rgba(212,168,67,0.25)', color: '#d4a843' }
          }
        >
          {address ? 'Отключить' : 'Подключить'}
        </button>
      </motion.div>

      {/* Tab switcher */}
      <div className="flex gap-1.5 mb-5 rounded-2xl p-1.5" style={{ background: 'rgba(255,255,255,0.03)' }}>
        {([
          { key: 'buy' as Tab, label: '💳 Приобрести Активы' },
          { key: 'exchange' as Tab, label: '🔄 Обменять' },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setDepositInfo(null) }}
            className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all relative"
            style={{ color: tab === t.key ? 'white' : '#6b7280' }}
          >
            {tab === t.key && (
              <motion.div layoutId="deposit-tab" className="absolute inset-0 rounded-xl"
                style={{ background: '#1c1c1c', border: '1px solid rgba(255,255,255,0.08)' }} />
            )}
            <span className="relative z-10">{t.label}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">

        {/* ── BUY tab ── */}
        {tab === 'buy' && (
          <motion.div key="buy" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">

            {/* Amount input */}
            <div className="rounded-2xl p-4" style={{ background: '#1c1c1c', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p className="text-xs text-gray-500 mb-3">Сумма в RR</p>
              <div className="flex items-center gap-3 mb-3">
                <input
                  type="number"
                  value={amountRR}
                  onChange={(e) => setAmountRR(Math.max(10, Number(e.target.value)))}
                  className="flex-1 rounded-xl px-4 py-3 text-lg font-bold outline-none text-white"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                  min={10}
                />
                <span className="text-poker-gold font-bold text-sm">RR</span>
              </div>
              {/* Quick amounts */}
              <div className="grid grid-cols-4 gap-2">
                {[500, 1000, 5000, 10000].map((v) => (
                  <button key={v} onClick={() => setAmountRR(v)}
                    className="py-2 rounded-xl text-xs font-bold transition-all"
                    style={amountRR === v
                      ? { background: 'rgba(212,168,67,0.15)', border: '1px solid rgba(212,168,67,0.4)', color: '#d4a843' }
                      : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: '#6b7280' }
                    }>
                    {v >= 1000 ? `${v / 1000}K` : v}
                  </button>
                ))}
              </div>
            </div>

            {/* Rate info */}
            {rates && (
              <div className="rounded-2xl p-4 flex items-center justify-between"
                style={{ background: 'rgba(212,168,67,0.05)', border: '1px solid rgba(212,168,67,0.15)' }}>
                <div>
                  <p className="text-xs text-gray-500">К оплате</p>
                  <p className="text-xl font-extrabold text-poker-gold">{tonAmount} TON</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Курс</p>
                  <p className="text-xs text-gray-400">{rates.rr_per_ton} RR / TON</p>
                </div>
              </div>
            )}

            {/* Deposit info after init */}
            {depositInfo && (
              <motion.div
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl p-4 space-y-3"
                style={{ background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.2)' }}
              >
                <p className="text-xs font-bold text-green-400">Детали платежа</p>
                <div>
                  <p className="text-[10px] text-gray-500 mb-1">Адрес кошелька</p>
                  <p className="text-xs font-mono text-white break-all">{depositInfo.wallet_address}</p>
                </div>
                <div className="flex gap-4">
                  <div>
                    <p className="text-[10px] text-gray-500 mb-1">Сумма</p>
                    <p className="text-sm font-bold text-poker-gold">{depositInfo.amount_crypto} TON</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 mb-1">Комментарий (обязательно)</p>
                    <p className="text-xs font-mono text-white">{depositInfo.comment}</p>
                  </div>
                </div>
                {address ? (
                  <button
                    onClick={handleSendTon}
                    disabled={sending}
                    className="w-full btn-gold py-3.5 rounded-xl text-sm font-bold disabled:opacity-50"
                  >
                    {sending ? 'Отправка...' : `Отправить ${depositInfo.amount_crypto} TON`}
                  </button>
                ) : (
                  <button
                    onClick={() => tonConnectUI.openModal()}
                    className="w-full py-3.5 rounded-xl text-sm font-bold"
                    style={{ background: 'rgba(212,168,67,0.1)', border: '1px solid rgba(212,168,67,0.3)', color: '#d4a843' }}
                  >
                    Подключить кошелёк для оплаты
                  </button>
                )}
              </motion.div>
            )}

            {!depositInfo && (
              <button
                onClick={handleInitDeposit}
                disabled={loading || amountRR < 10}
                className="w-full btn-gold py-4 rounded-2xl text-sm font-bold disabled:opacity-50"
              >
                {loading ? 'Загрузка...' : `Приобрести ${amountRR.toLocaleString()} RR`}
              </button>
            )}

          </motion.div>
        )}

        {/* ── EXCHANGE tab ── */}
        {tab === 'exchange' && (
          <motion.div key="exchange" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">

            <div className="rounded-2xl p-4" style={{ background: '#1c1c1c', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p className="text-xs text-gray-500 mb-3">Сумма вывода (RR)</p>
              <div className="flex items-center gap-3 mb-3">
                <input
                  type="number"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(Math.max(10, Number(e.target.value)))}
                  className="flex-1 rounded-xl px-4 py-3 text-lg font-bold outline-none text-white"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                  min={10}
                  max={balance}
                />
                <span className="text-poker-gold font-bold text-sm">RR</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[500, 1000, 5000, 10000].map((v) => (
                  <button key={v} onClick={() => setWithdrawAmount(Math.min(v, balance))}
                    className="py-2 rounded-xl text-xs font-bold transition-all"
                    style={withdrawAmount === v
                      ? { background: 'rgba(212,168,67,0.15)', border: '1px solid rgba(212,168,67,0.4)', color: '#d4a843' }
                      : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: '#6b7280' }
                    }>
                    {v >= 1000 ? `${v / 1000}K` : v}
                  </button>
                ))}
              </div>
            </div>

            {rates && (
              <div className="rounded-2xl p-4 flex items-center justify-between"
                style={{ background: 'rgba(212,168,67,0.05)', border: '1px solid rgba(212,168,67,0.15)' }}>
                <div>
                  <p className="text-xs text-gray-500">Получите</p>
                  <p className="text-xl font-extrabold text-poker-gold">
                    {(withdrawAmount * rates.rate_ton_per_rr).toFixed(4)} TON
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Курс</p>
                  <p className="text-xs text-gray-400">{rates.rr_per_ton} RR / TON</p>
                </div>
              </div>
            )}

            <div className="rounded-2xl p-4" style={{ background: '#1c1c1c', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p className="text-xs text-gray-500 mb-2">TON адрес для получения</p>
              <input
                value={withdrawWallet}
                onChange={(e) => setWithdrawWallet(e.target.value)}
                placeholder="UQ... или EQ..."
                className="w-full rounded-xl px-4 py-3 text-xs font-mono outline-none text-white"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
              />
              {address && withdrawWallet !== address && (
                <button
                  onClick={() => setWithdrawWallet(address)}
                  className="mt-2 text-[10px] text-poker-gold underline"
                >
                  Использовать подключённый кошелёк
                </button>
              )}
            </div>

            <button
              onClick={handleWithdraw}
              disabled={withdrawing || withdrawAmount < 10 || withdrawAmount > balance || !withdrawWallet.trim()}
              className="w-full btn-gold py-4 rounded-2xl text-sm font-bold disabled:opacity-50"
            >
              {withdrawing ? 'Обработка...' : `Обменять ${withdrawAmount.toLocaleString()} RR`}
            </button>

            <p className="text-[10px] text-gray-600 text-center">
              Заявки обрабатываются в течение 24 часов
            </p>

          </motion.div>
        )}

      </AnimatePresence>
    </div>
  )
}
