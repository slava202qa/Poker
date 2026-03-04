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
        // Demo tables for offline mode
        const demo: Table[] = tab === 'chip'
          ? [
              { id: 1, name: 'Micro Stakes', currency: 'chip', max_players: 9, small_blind: 1, big_blind: 2, min_buy_in: 40, max_buy_in: 200, status: 'waiting', current_players: 3 },
              { id: 2, name: 'Low Stakes', currency: 'chip', max_players: 6, small_blind: 5, big_blind: 10, min_buy_in: 200, max_buy_in: 1000, status: 'playing', current_players: 5 },
            ]
          : [
              { id: 101, name: 'Fun Micro', currency: 'fun', max_players: 9, small_blind: 5, big_blind: 10, min_buy_in: 200, max_buy_in: 1000, status: 'waiting', current_players: 2 },
              { id: 102, name: 'Fun Mid', currency: 'fun', max_players: 6, small_blind: 25, big_blind: 50, min_buy_in: 1000, max_buy_in: 5000, status: 'playing', current_players: 4 },
            ]
        setTables(demo)
      })
      .finally(() => setLoading(false))
  }, [tab])

  const isChip = tab === 'chip'
  const balance = isChip ? (user?.balance ?? 0) : (user?.fun_balance ?? 0)
  const currencyLabel = isChip ? 'CHIP' : 'FUN'
  const accentColor = isChip ? 'poker-gold' : 'emerald-400'
  const accentBg = isChip ? 'bg-poker-gold' : 'bg-emerald-500'
  const accentText = isChip ? 'text-poker-gold' : 'text-emerald-400'

  return (
    <div className="min-h-screen pb-20 px-4 pt-6">
      {/* Tab switcher */}
      <div className="flex gap-2 mb-4">
        {(['chip', 'fun'] as Currency[]).map((c) => (
          <button
            key={c}
            onClick={() => setTab(c)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
              tab === c
                ? c === 'chip'
                  ? 'bg-poker-gold/20 text-poker-gold border border-poker-gold/40'
                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                : 'bg-gray-800/50 text-gray-500 border border-gray-700/30'
            }`}
          >
            {c === 'chip' ? '💰 CHIP (реальные)' : '🎲 FUN (бесплатно)'}
          </button>
        ))}
      </div>

      {/* Balance bar */}
      <div className={`rounded-xl px-4 py-2.5 mb-5 flex items-center justify-between ${
        isChip ? 'bg-yellow-900/20 border border-poker-gold/20' : 'bg-emerald-900/20 border border-emerald-500/20'
      }`}>
        <span className="text-sm text-gray-400">Баланс {currencyLabel}</span>
        <span className={`font-bold ${accentText}`}>
          {balance.toLocaleString()} {currencyLabel}
        </span>
      </div>

      <motion.h1
        key={tab}
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        className="text-2xl font-bold mb-4"
      >
        {isChip ? '🃏 Кэш-столы' : '🎲 Бесплатные столы'}
      </motion.h1>

      {!isChip && (
        <p className="text-sm text-gray-500 mb-4">
          Играйте бесплатно на фантики. Без рейка, без вывода. Пополнение каждые 4 часа.
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-poker-gold border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-3"
          >
            {tables.length === 0 ? (
              <div className="text-center text-gray-500 py-16">
                Нет доступных столов
              </div>
            ) : (
              tables.map((table, i) => (
                <motion.div
                  key={table.id}
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => navigate(`/table/${table.id}`)}
                  className={`card-surface p-4 cursor-pointer transition-all active:scale-[0.98] ${
                    isChip
                      ? 'hover:border-poker-gold/30'
                      : 'hover:border-emerald-500/30'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold">{table.name}</h3>
                      {!isChip && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-900/50 text-emerald-400 font-medium">
                          FREE
                        </span>
                      )}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      table.status === 'playing'
                        ? 'bg-green-900/50 text-green-400'
                        : 'bg-gray-800 text-gray-400'
                    }`}>
                      {table.status === 'playing' ? 'Идёт игра' : 'Ожидание'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <div className="text-gray-400">
                      Блайнды: <span className="text-white">{table.small_blind}/{table.big_blind}</span>
                    </div>
                    <div className="text-gray-400">
                      Бай-ин: <span className={accentText}>{table.min_buy_in}-{table.max_buy_in}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                    <span>Игроки: {table.current_players}/{table.max_players}</span>
                    <div className="flex gap-0.5">
                      {Array.from({ length: table.max_players }).map((_, j) => (
                        <div
                          key={j}
                          className={`w-2 h-2 rounded-full ${
                            j < table.current_players
                              ? isChip ? 'bg-poker-gold' : 'bg-emerald-400'
                              : 'bg-gray-700'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </motion.div>
        </AnimatePresence>
      )}

      {/* FUN refill button */}
      {!isChip && (
        <FunRefillButton balance={balance} />
      )}
    </div>
  )
}

function FunRefillButton({ balance }: { balance: number }) {
  const api = useApi()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const setUser = useStore((s) => s.setUser)
  const user = useStore((s) => s.user)

  const handleRefill = async () => {
    setLoading(true)
    setMessage('')
    try {
      const res = await api.post<{ fun_balance: number }>('/economy/fun/refill')
      if (user) {
        setUser({ ...user, fun_balance: res.fun_balance })
      }
      setMessage('✅ +10 000 FUN зачислено!')
    } catch (e: any) {
      setMessage(`❌ ${e?.detail || 'Ошибка'}`)
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
        className="w-full max-w-lg mx-auto block py-3 rounded-xl bg-emerald-600 text-white font-bold text-sm active:scale-[0.98] transition-all disabled:opacity-50"
      >
        {loading ? 'Пополняем...' : '🎁 Бесплатное пополнение FUN'}
      </button>
      {message && (
        <p className="text-center text-sm mt-2 text-gray-300">{message}</p>
      )}
    </div>
  )
}
