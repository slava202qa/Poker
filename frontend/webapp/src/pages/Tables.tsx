import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useApi } from '../hooks/useApi'
import { useStore } from '../store/useStore'

type Currency = 'chip' | 'fun'

interface Table {
  id: number
  name: string
  currency: string
  max_players: number
  small_blind: number
  big_blind: number
  min_buy_in: number
  max_buy_in: number
  status: string
  current_players: number
}

// Casino venue names for demo tables
const VIP_NAMES   = ['Monaco', 'Las Vegas', 'Macau', 'Monte Carlo', 'Baden-Baden']
const PUB_NAMES   = ['Atlantic City', 'Reno', 'Biloxi', 'Tunica', 'Laughlin']

function getVenueName(id: number, isVip: boolean) {
  const arr = isVip ? VIP_NAMES : PUB_NAMES
  return arr[id % arr.length]
}

export default function Tables() {
  const [tables, setTables] = useState<Table[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Currency>('chip')
  const navigate = useNavigate()
  const api = useApi()
  const user = useStore((s) => s.user)

  useEffect(() => {
    setLoading(true)
    api.get<Table[]>(`/tables/?currency=${tab}`)
      .then(setTables)
      .catch(() => {
        const demo: Table[] = tab === 'chip'
          ? [
              { id: 1, name: 'Monaco',      currency: 'chip', max_players: 9, small_blind: 1,  big_blind: 2,  min_buy_in: 40,   max_buy_in: 200,  status: 'waiting', current_players: 3 },
              { id: 2, name: 'Las Vegas',   currency: 'chip', max_players: 6, small_blind: 5,  big_blind: 10, min_buy_in: 200,  max_buy_in: 1000, status: 'playing', current_players: 5 },
              { id: 3, name: 'Macau',       currency: 'chip', max_players: 9, small_blind: 25, big_blind: 50, min_buy_in: 1000, max_buy_in: 5000, status: 'waiting', current_players: 1 },
            ]
          : [
              { id: 101, name: 'Atlantic City', currency: 'fun', max_players: 9, small_blind: 5,  big_blind: 10, min_buy_in: 200,  max_buy_in: 1000, status: 'waiting', current_players: 2 },
              { id: 102, name: 'Reno',          currency: 'fun', max_players: 6, small_blind: 25, big_blind: 50, min_buy_in: 1000, max_buy_in: 5000, status: 'playing', current_players: 4 },
            ]
        setTables(demo)
      })
      .finally(() => setLoading(false))
  }, [tab])

  const isVip = tab === 'chip'
  const balance = isVip ? (user?.balance ?? 0) : (user?.fun_balance ?? 0)

  return (
    <div className="min-h-screen pb-20 px-4 pt-5 relative z-10">

      {/* ── Tab switcher ── */}
      <div className="flex gap-2 mb-5">
        {(['chip', 'fun'] as Currency[]).map((c) => (
          <button
            key={c}
            onClick={() => setTab(c)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
              tab === c ? 'tab-pill-active' : 'tab-pill-inactive'
            }`}
          >
            {c === 'chip' ? '♠ VIP Клуб' : '♣ Public Hall'}
          </button>
        ))}
      </div>

      {/* ── Balance bar ── */}
      <div
        className="rounded-xl px-4 py-2.5 mb-5 flex items-center justify-between"
        style={{
          background: isVip ? 'rgba(212,168,67,0.06)' : 'rgba(99,102,241,0.06)',
          border: `1px solid ${isVip ? 'rgba(212,168,67,0.15)' : 'rgba(99,102,241,0.15)'}`,
        }}
      >
        <span className="text-xs text-gray-500">Ваши активы</span>
        <span className={`font-bold text-sm ${isVip ? 'text-poker-gold' : 'text-indigo-400'}`}>
          {balance.toLocaleString()} {isVip ? 'RR' : 'BR'}
        </span>
      </div>

      {/* ── Section title ── */}
      <motion.h2
        key={tab}
        initial={{ x: -16, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        className="text-lg font-extrabold mb-4 tracking-tight"
      >
        {isVip ? '♠ VIP Столы' : '♣ Открытые Столы'}
      </motion.h2>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-7 h-7 border-2 border-poker-gold border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-3"
          >
            {tables.map((table, i) => (
              <TableCard
                key={table.id}
                table={table}
                index={i}
                isVip={isVip}
                onClick={() => navigate(`/table/${table.id}`)}
              />
            ))}
          </motion.div>
        </AnimatePresence>
      )}

      {!isVip && <FunRefillButton balance={balance} />}
    </div>
  )
}

function TableCard({
  table, index, isVip, onClick,
}: {
  table: Table
  index: number
  isVip: boolean
  onClick: () => void
}) {
  const isPlaying = table.status === 'playing'
  const fillPct = Math.round((table.current_players / table.max_players) * 100)

  return (
    <motion.div
      initial={{ x: -16, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ delay: index * 0.06 }}
      onClick={onClick}
      className="cursor-pointer active:scale-[0.98] transition-transform"
      style={{
        background: isVip
          ? 'linear-gradient(135deg, #1e1a0e 0%, #1c1c1c 100%)'
          : 'linear-gradient(135deg, #111 0%, #1c1c1c 100%)',
        border: `1px solid ${isVip ? 'rgba(212,168,67,0.18)' : 'rgba(99,102,241,0.15)'}`,
        borderRadius: '16px',
        boxShadow: isVip
          ? '0 4px 20px rgba(0,0,0,0.5), 0 0 12px rgba(212,168,67,0.04)'
          : '0 4px 20px rgba(0,0,0,0.5)',
      }}
    >
      <div className="p-4">
        {/* Top row */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-base tracking-tight">{table.name}</h3>
              {isVip && (
                <span className="text-[9px] px-1.5 py-0.5 rounded font-bold tracking-wider"
                  style={{ background: 'rgba(212,168,67,0.12)', color: '#d4a843' }}>
                  VIP
                </span>
              )}
            </div>
            <p className="text-[11px] text-gray-600 mt-0.5">
              Блайнды {table.small_blind}/{table.big_blind} · Бай-ин {table.min_buy_in}–{table.max_buy_in}
            </p>
          </div>
          <span
            className="text-[10px] px-2 py-1 rounded-full font-semibold"
            style={{
              background: isPlaying ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.05)',
              color: isPlaying ? '#4ade80' : '#6b7280',
              border: `1px solid ${isPlaying ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.06)'}`,
            }}
          >
            {isPlaying ? '● Идёт игра' : '○ Ожидание'}
          </span>
        </div>

        {/* Divider */}
        <div className="divider-gold mb-3" />

        {/* Bottom row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {Array.from({ length: table.max_players }).map((_, j) => (
              <div
                key={j}
                className="w-2 h-2 rounded-full transition-colors"
                style={{
                  background: j < table.current_players
                    ? isVip ? '#d4a843' : '#818cf8'
                    : 'rgba(255,255,255,0.08)',
                }}
              />
            ))}
          </div>
          <span className="text-[11px] text-gray-600">
            {table.current_players}/{table.max_players} игроков
          </span>
        </div>
      </div>
    </motion.div>
  )
}

function FunRefillButton({ balance }: { balance: number }) {
  const api = useApi()
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const setUser = useStore((s) => s.setUser)
  const user = useStore((s) => s.user)

  const handleRefill = async () => {
    setLoading(true)
    setMsg('')
    try {
      const res = await api.post<{ fun_balance: number }>('/economy/fun/refill')
      if (user) setUser({ ...user, fun_balance: res.fun_balance })
      setMsg('✅ +10 000 BR зачислено!')
    } catch (e: any) {
      setMsg(`❌ ${e?.detail || 'Ошибка'}`)
    } finally {
      setLoading(false)
    }
  }

  if (balance >= 1000) return null

  return (
    <div className="fixed bottom-20 left-0 right-0 px-4">
      <button
        onClick={handleRefill}
        disabled={loading}
        className="w-full max-w-lg mx-auto block py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-50"
        style={{ background: 'rgba(99,102,241,0.8)', color: 'white' }}
      >
        {loading ? 'Пополняем...' : '🎁 Бесплатное пополнение BR'}
      </button>
      {msg && <p className="text-center text-sm mt-2 text-gray-400">{msg}</p>}
    </div>
  )
}
