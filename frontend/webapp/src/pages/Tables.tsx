import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useApi } from '../hooks/useApi'

interface Table {
  id: number
  name: string
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
  const navigate = useNavigate()
  const api = useApi()

  useEffect(() => {
    api.get<Table[]>('/tables/')
      .then(setTables)
      .catch(() => {
        // Demo tables for offline mode
        setTables([
          { id: 1, name: 'Micro Stakes', max_players: 9, small_blind: 1, big_blind: 2, min_buy_in: 40, max_buy_in: 200, status: 'waiting', current_players: 3 },
          { id: 2, name: 'Low Stakes', max_players: 6, small_blind: 5, big_blind: 10, min_buy_in: 200, max_buy_in: 1000, status: 'playing', current_players: 5 },
          { id: 3, name: 'Mid Stakes', max_players: 9, small_blind: 25, big_blind: 50, min_buy_in: 1000, max_buy_in: 5000, status: 'waiting', current_players: 1 },
          { id: 4, name: 'High Roller', max_players: 6, small_blind: 100, big_blind: 200, min_buy_in: 4000, max_buy_in: 20000, status: 'waiting', current_players: 0 },
        ])
      })
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen pb-20 px-4 pt-6">
      <motion.h1
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        className="text-2xl font-bold mb-6"
      >
        🃏 Кэш-столы
      </motion.h1>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-poker-gold border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {tables.map((table, i) => (
            <motion.div
              key={table.id}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => navigate(`/table/${table.id}`)}
              className="card-surface p-4 cursor-pointer hover:border-poker-gold/30 transition-all active:scale-[0.98]"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold">{table.name}</h3>
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
                  Бай-ин: <span className="text-poker-gold">{table.min_buy_in}-{table.max_buy_in}</span>
                </div>
              </div>

              <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                <span>Игроки: {table.current_players}/{table.max_players}</span>
                <div className="flex gap-0.5">
                  {Array.from({ length: table.max_players }).map((_, j) => (
                    <div
                      key={j}
                      className={`w-2 h-2 rounded-full ${
                        j < table.current_players ? 'bg-poker-gold' : 'bg-gray-700'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
