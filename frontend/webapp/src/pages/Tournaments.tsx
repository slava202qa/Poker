import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useApi } from '../hooks/useApi'

interface Tournament {
  id: number
  name: string
  buy_in: number
  fee: number
  starting_stack: number
  max_players: number
  current_players: number
  prize_pool: number
  status: string
  starts_at: string
}

export default function Tournaments() {
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(true)
  const api = useApi()

  useEffect(() => {
    api.get<Tournament[]>('/tournaments/')
      .then(setTournaments)
      .catch(() => {
        setTournaments([
          { id: 1, name: 'Daily Freeroll', buy_in: 0, fee: 0, starting_stack: 1500, max_players: 100, current_players: 47, prize_pool: 1000, status: 'registering', starts_at: new Date(Date.now() + 3600000).toISOString() },
          { id: 2, name: 'Evening Tournament', buy_in: 100, fee: 10, starting_stack: 3000, max_players: 50, current_players: 23, prize_pool: 2300, status: 'registering', starts_at: new Date(Date.now() + 7200000).toISOString() },
          { id: 3, name: 'High Roller Weekly', buy_in: 1000, fee: 50, starting_stack: 10000, max_players: 20, current_players: 8, prize_pool: 8000, status: 'registering', starts_at: new Date(Date.now() + 86400000).toISOString() },
        ])
      })
      .finally(() => setLoading(false))
  }, [])

  const formatTime = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })
  }

  const handleRegister = async (id: number) => {
    try {
      await api.post(`/tournaments/${id}/register`)
      // Refresh
      const updated = await api.get<Tournament[]>('/tournaments/')
      setTournaments(updated)
    } catch (e: any) {
      alert(e.message || 'Ошибка регистрации')
    }
  }

  return (
    <div className="min-h-screen pb-20 px-4 pt-6">
      <motion.h1
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        className="text-2xl font-bold mb-6"
      >
        🏆 Турниры
      </motion.h1>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-poker-gold border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {tournaments.map((t, i) => (
            <motion.div
              key={t.id}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: i * 0.05 }}
              className="card-surface p-4"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-bold">{t.name}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Старт: {formatTime(t.starts_at)}
                  </p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  t.status === 'registering'
                    ? 'bg-green-900/50 text-green-400'
                    : t.status === 'running'
                    ? 'bg-yellow-900/50 text-yellow-400'
                    : 'bg-gray-800 text-gray-400'
                }`}>
                  {t.status === 'registering' ? 'Регистрация' : t.status === 'running' ? 'Идёт' : t.status}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center mb-3">
                <div className="bg-poker-darker rounded-lg p-2">
                  <p className="text-poker-gold font-bold">{t.buy_in > 0 ? `${t.buy_in}+${t.fee}` : 'FREE'}</p>
                  <p className="text-[10px] text-gray-500">Бай-ин</p>
                </div>
                <div className="bg-poker-darker rounded-lg p-2">
                  <p className="text-poker-gold-light font-bold">{t.prize_pool.toLocaleString()}</p>
                  <p className="text-[10px] text-gray-500">Призовой фонд</p>
                </div>
                <div className="bg-poker-darker rounded-lg p-2">
                  <p className="text-white font-bold">{t.current_players}/{t.max_players}</p>
                  <p className="text-[10px] text-gray-500">Игроки</p>
                </div>
              </div>

              {t.status === 'registering' && (
                <button
                  onClick={() => handleRegister(t.id)}
                  className="w-full btn-gold py-2.5 text-sm"
                >
                  Зарегистрироваться {t.buy_in > 0 ? `(${t.buy_in + t.fee} CHIP)` : ''}
                </button>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
