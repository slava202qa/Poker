import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useApi } from '../../hooks/useApi'

interface Tx {
  id: number
  user_id: number
  username: string | null
  first_name: string
  tx_type: string
  amount: number
  balance_after: number
  reference: string | null
  ton_tx_hash: string | null
  created_at: string
}

const TX_TYPES = ['all', 'deposit', 'withdraw', 'win', 'loss', 'rake', 'fun_refill', 'shop_purchase']

const TX_COLOR: Record<string, { bg: string; color: string; label: string }> = {
  deposit:       { bg: 'rgba(34,197,94,0.1)',   color: '#4ade80', label: 'Депозит'   },
  withdraw:      { bg: 'rgba(239,68,68,0.1)',    color: '#f87171', label: 'Вывод'     },
  win:           { bg: 'rgba(212,168,67,0.1)',   color: '#d4a843', label: 'Выигрыш'  },
  loss:          { bg: 'rgba(156,163,175,0.1)',  color: '#9ca3af', label: 'Проигрыш' },
  rake:          { bg: 'rgba(168,85,247,0.1)',   color: '#c084fc', label: 'Рейк'     },
  fun_refill:    { bg: 'rgba(99,102,241,0.1)',   color: '#818cf8', label: 'BR'        },
  shop_purchase: { bg: 'rgba(251,191,36,0.1)',   color: '#fbbf24', label: 'Магазин'  },
}

export default function AdminTransactions() {
  const { get } = useApi()
  const [txs, setTxs] = useState<Tx[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(0)
  const PAGE = 50

  const load = async (f = filter, p = page) => {
    setLoading(true)
    try {
      const data = await get<Tx[]>(`/admin/transactions?tx_type=${f}&limit=${PAGE}&offset=${p * PAGE}`)
      setTxs(data)
    } catch { setTxs([]) }
    finally { setLoading(false) }
  }

  useEffect(() => { load(filter, 0); setPage(0) }, [filter])
  useEffect(() => { if (page > 0) load(filter, page) }, [page])

  const totalIn  = txs.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0)
  const totalOut = txs.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)

  return (
    <div className="p-4 relative z-10">
      <h2 className="text-lg font-extrabold mb-4">Транзакции</h2>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="card-surface p-3 text-center">
          <div className="text-sm font-extrabold text-emerald-400">+{totalIn.toLocaleString()}</div>
          <div className="text-[10px] text-gray-600">Приход (стр.)</div>
        </div>
        <div className="card-surface p-3 text-center">
          <div className="text-sm font-extrabold text-red-400">-{totalOut.toLocaleString()}</div>
          <div className="text-[10px] text-gray-600">Расход (стр.)</div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
        {TX_TYPES.map(t => (
          <button key={t} onClick={() => setFilter(t)}
            className="flex-shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all"
            style={filter === t
              ? { background: 'rgba(212,168,67,0.12)', color: '#d4a843', border: '1px solid rgba(212,168,67,0.3)' }
              : { background: 'rgba(255,255,255,0.04)', color: '#6b7280', border: '1px solid rgba(255,255,255,0.06)' }}>
            {TX_COLOR[t]?.label ?? (t === 'all' ? 'Все' : t)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-7 h-7 border-2 border-poker-gold border-t-transparent rounded-full animate-spin" />
        </div>
      ) : txs.length === 0 ? (
        <div className="text-center text-gray-600 py-12">Нет транзакций</div>
      ) : (
        <>
          <div className="space-y-2">
            {txs.map((tx, i) => {
              const style = TX_COLOR[tx.tx_type] ?? { bg: 'rgba(255,255,255,0.05)', color: '#9ca3af', label: tx.tx_type }
              return (
                <motion.div key={tx.id}
                  initial={{ x: -8, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: i * 0.02 }}
                  className="rounded-xl p-3 flex items-center gap-3"
                  style={{ background: '#1c1c1c', border: '1px solid rgba(255,255,255,0.06)' }}>

                  {/* Type badge */}
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-bold"
                    style={{ background: style.bg, color: style.color }}>
                    {tx.amount > 0 ? '+' : '−'}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold truncate">
                        {tx.first_name}{tx.username ? ` @${tx.username}` : ''}
                      </span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded font-bold flex-shrink-0"
                        style={{ background: style.bg, color: style.color }}>
                        {style.label}
                      </span>
                    </div>
                    <div className="text-[10px] text-gray-600 truncate">
                      {tx.reference ?? '—'}
                      {tx.ton_tx_hash && <span className="ml-1 text-emerald-400">· TX</span>}
                    </div>
                    <div className="text-[10px] text-gray-700">
                      {new Date(tx.created_at).toLocaleString('ru-RU')}
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <div className="font-extrabold text-sm" style={{ color: tx.amount > 0 ? '#4ade80' : '#f87171' }}>
                      {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString()} RR
                    </div>
                    <div className="text-[10px] text-gray-600">→ {tx.balance_after.toLocaleString()}</div>
                  </div>
                </motion.div>
              )
            })}
          </div>

          {/* Pagination */}
          <div className="flex gap-2 mt-4 justify-center">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              className="px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-30"
              style={{ background: 'rgba(255,255,255,0.05)', color: '#9ca3af' }}>
              ← Назад
            </button>
            <span className="px-4 py-2 text-sm text-gray-600">стр. {page + 1}</span>
            <button onClick={() => setPage(p => p + 1)} disabled={txs.length < PAGE}
              className="px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-30"
              style={{ background: 'rgba(255,255,255,0.05)', color: '#9ca3af' }}>
              Вперёд →
            </button>
          </div>
        </>
      )}
    </div>
  )
}
