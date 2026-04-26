import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useApi } from '../../hooks/useApi'

interface Winner {
  user_id: number
  amount: number
  hand_rank: string
  cards?: string[]
}

interface Hand {
  id: number
  table_id: number | null
  table_name: string | null
  pot: number
  rake: number
  poker_type: string
  player_count: number
  winners: Winner[]
  community_cards: string[]
  finished_at: string | null
}

const HAND_RANK_LABELS: Record<string, string> = {
  ROYAL_FLUSH: 'Роял-флеш',
  STRAIGHT_FLUSH: 'Стрит-флеш',
  FOUR_OF_A_KIND: 'Каре',
  FULL_HOUSE: 'Фулл-хаус',
  FLUSH: 'Флеш',
  STRAIGHT: 'Стрит',
  THREE_OF_A_KIND: 'Тройка',
  TWO_PAIR: 'Две пары',
  ONE_PAIR: 'Пара',
  HIGH_CARD: 'Старшая карта',
}

function fmt(dt: string | null) {
  if (!dt) return '—'
  const d = new Date(dt)
  return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function AdminHandHistory() {
  const [hands, setHands] = useState<Hand[]>([])
  const [loading, setLoading] = useState(true)
  const [tableFilter, setTableFilter] = useState('')
  const [expanded, setExpanded] = useState<number | null>(null)
  const api = useApi()

  const load = async () => {
    setLoading(true)
    try {
      const params = tableFilter ? `?table_id=${tableFilter}&limit=100` : '?limit=100'
      const data = await api.get<Hand[]>(`/admin/hand-history${params}`)
      setHands(data)
    } catch {
      setHands([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">🃏 История раздач</h2>
        <button onClick={load} className="text-xs px-3 py-1.5 rounded-lg"
          style={{ background: 'rgba(212,168,67,0.1)', border: '1px solid rgba(212,168,67,0.25)', color: '#d4a843' }}>
          Обновить
        </button>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        <input
          type="number"
          placeholder="ID стола (фильтр)"
          value={tableFilter}
          onChange={e => setTableFilter(e.target.value)}
          className="flex-1 rounded-xl px-3 py-2 text-sm bg-black/40 border border-poker-border text-white"
        />
        <button onClick={load}
          className="px-4 py-2 rounded-xl text-xs font-bold"
          style={{ background: 'rgba(212,168,67,0.1)', border: '1px solid rgba(212,168,67,0.25)', color: '#d4a843' }}>
          Найти
        </button>
        {tableFilter && (
          <button onClick={() => { setTableFilter(''); setTimeout(load, 0) }}
            className="px-3 py-2 rounded-xl text-xs text-gray-400 border border-poker-border">
            ✕
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-poker-gold border-t-transparent rounded-full animate-spin" />
        </div>
      ) : hands.length === 0 ? (
        <div className="text-center py-12 text-gray-500">Раздач пока нет</div>
      ) : (
        <div className="space-y-2">
          {hands.map((hand, i) => (
            <motion.div
              key={hand.id}
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: i * 0.02 }}
              className="card-surface overflow-hidden"
            >
              {/* Header row */}
              <button
                className="w-full p-4 text-left"
                onClick={() => setExpanded(expanded === hand.id ? null : hand.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-gray-600">#{hand.id}</span>
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {hand.table_name ?? `Стол #${hand.table_id}`}
                        <span className="ml-2 text-[10px] text-gray-500 font-normal uppercase">
                          {hand.poker_type}
                        </span>
                      </p>
                      <p className="text-xs text-gray-500">{fmt(hand.finished_at)} · {hand.player_count} игроков</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-poker-gold">{hand.pot.toFixed(0)} RR</p>
                    <p className="text-[10px] text-gray-600">рейк {hand.rake.toFixed(1)}</p>
                  </div>
                </div>

                {/* Winners summary */}
                {hand.winners.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {hand.winners.map((w, wi) => (
                      <span key={wi} className="text-[10px] px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(212,168,67,0.1)', border: '1px solid rgba(212,168,67,0.2)', color: '#d4a843' }}>
                        #{w.user_id} +{w.amount.toFixed(0)} · {HAND_RANK_LABELS[w.hand_rank] ?? w.hand_rank}
                      </span>
                    ))}
                  </div>
                )}
              </button>

              {/* Expanded detail */}
              {expanded === hand.id && (
                <div className="border-t border-poker-border px-4 pb-4 pt-3 space-y-3">
                  {/* Community cards */}
                  {hand.community_cards.length > 0 && (
                    <div>
                      <p className="text-[10px] text-gray-500 mb-1 uppercase tracking-wider">Борд</p>
                      <div className="flex gap-1.5 flex-wrap">
                        {hand.community_cards.map((card, ci) => (
                          <span key={ci} className="text-sm font-bold px-2 py-1 rounded-lg"
                            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}>
                            {card}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Winners detail */}
                  {hand.winners.length > 0 && (
                    <div>
                      <p className="text-[10px] text-gray-500 mb-2 uppercase tracking-wider">Победители</p>
                      <div className="space-y-2">
                        {hand.winners.map((w, wi) => (
                          <div key={wi} className="flex items-start justify-between">
                            <div>
                              <p className="text-xs text-white font-semibold">Игрок #{w.user_id}</p>
                              <p className="text-[10px] text-gray-500">{HAND_RANK_LABELS[w.hand_rank] ?? w.hand_rank}</p>
                              {w.cards && w.cards.length > 0 && (
                                <div className="flex gap-1 mt-1">
                                  {w.cards.map((c: any, ci: number) => (
                                    <span key={ci} className="text-xs px-1.5 py-0.5 rounded"
                                      style={{ background: 'rgba(212,168,67,0.08)', border: '1px solid rgba(212,168,67,0.15)', color: '#d4a843' }}>
                                      {typeof c === 'string' ? c : c?.display ?? JSON.stringify(c)}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <span className="text-sm font-bold text-green-400">+{w.amount.toFixed(0)} RR</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
