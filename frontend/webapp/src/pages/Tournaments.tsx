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

// Live countdown hook
function useCountdown(targetIso: string) {
  const [diff, setDiff] = useState(Math.max(0, new Date(targetIso).getTime() - Date.now()))
  useEffect(() => {
    const id = setInterval(() => setDiff(Math.max(0, new Date(targetIso).getTime() - Date.now())), 1000)
    return () => clearInterval(id)
  }, [targetIso])
  if (diff === 0) return 'Начался'
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}

function TournamentCard({ t, index, onRegister }: {
  t: Tournament
  index: number
  onRegister: (id: number) => void
}) {
  const countdown = useCountdown(t.starts_at)
  const isRunning = t.status === 'running'
  const isFree = t.buy_in === 0

  return (
    <motion.div
      initial={{ y: 16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: index * 0.06 }}
      className="card-ticket p-4"
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="font-extrabold">{t.name}</h3>
            {isFree && (
              <span className="text-[9px] px-1.5 py-0.5 rounded font-bold"
                style={{ background: 'rgba(34,197,94,0.12)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.2)' }}>
                FREE
              </span>
            )}
          </div>
          <p className="text-[11px] text-gray-600">
            {isRunning ? '● Идёт' : `Старт через: ${countdown}`}
          </p>
        </div>
        <span className="text-[10px] px-2 py-1 rounded-full font-semibold"
          style={{
            background: isRunning ? 'rgba(234,179,8,0.1)' : 'rgba(34,197,94,0.08)',
            color: isRunning ? '#eab308' : '#4ade80',
            border: `1px solid ${isRunning ? 'rgba(234,179,8,0.2)' : 'rgba(34,197,94,0.15)'}`,
          }}>
          {isRunning ? 'Идёт' : 'Регистрация'}
        </span>
      </div>

      <div className="divider-gold mb-3" />

      <div className="grid grid-cols-3 gap-2 text-center mb-3">
        {[
          { label: 'Бай-ин',        value: isFree ? 'FREE' : `${t.buy_in}+${t.fee}` },
          { label: 'Призовой фонд', value: t.prize_pool.toLocaleString() },
          { label: 'Игроки',        value: `${t.current_players}/${t.max_players}` },
        ].map((item) => (
          <div key={item.label} className="rounded-xl py-2"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="font-bold text-sm text-poker-gold">{item.value}</div>
            <div className="text-[9px] text-gray-600 mt-0.5">{item.label}</div>
          </div>
        ))}
      </div>

      {t.status === 'registering' && (
        <button onClick={() => onRegister(t.id)} className="w-full btn-gold py-2.5 text-sm">
          Зарегистрироваться {!isFree && `(${t.buy_in + t.fee} RR)`}
        </button>
      )}
    </motion.div>
  )
}

export default function Tournaments() {
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const api = useApi()

  const load = () => {
    setLoading(true)
    api.get<Tournament[]>('/tournaments/')
      .then((data) => { setTournaments(data); setError(false) })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleRegister = async (id: number) => {
    try {
      await api.post(`/tournaments/${id}/register`)
      load()
    } catch (e: any) {
      alert(e.message || 'Ошибка регистрации')
    }
  }

  return (
    <div className="min-h-screen pb-20 px-4 pt-5 relative z-10">
      <motion.h1
        initial={{ x: -16, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        className="text-xl font-extrabold mb-5 tracking-tight"
      >
        Турнирный Холл
      </motion.h1>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-7 h-7 border-2 border-poker-gold border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error || tournaments.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="card-surface p-8 text-center"
        >
          <div className="text-4xl mb-3">🏆</div>
          <h3 className="font-bold text-base mb-2">Турниры скоро</h3>
          <p className="text-sm text-gray-500">
            Расписание турниров появится здесь. Следите за анонсами в боте.
          </p>
        </motion.div>
      ) : (
        <div className="space-y-3">
          {tournaments.map((t, i) => (
            <TournamentCard key={t.id} t={t} index={i} onRegister={handleRegister} />
          ))}
        </div>
      )}
    </div>
  )
}
