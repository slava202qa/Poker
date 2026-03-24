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

// Countdown hook
function useCountdown(targetIso: string) {
  const [diff, setDiff] = useState(Math.max(0, new Date(targetIso).getTime() - Date.now()))
  useEffect(() => {
    const id = setInterval(() => {
      setDiff(Math.max(0, new Date(targetIso).getTime() - Date.now()))
    }, 1000)
    return () => clearInterval(id)
  }, [targetIso])
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  return diff === 0 ? 'Начался' : `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}

// Sunday tournament — next Sunday 20:00 UTC
function nextSunday20(): string {
  const now = new Date()
  const day = now.getUTCDay() // 0=Sun
  const daysUntil = day === 0 ? 7 : 7 - day
  const d = new Date(now)
  d.setUTCDate(d.getUTCDate() + daysUntil)
  d.setUTCHours(20, 0, 0, 0)
  return d.toISOString()
}

function SundayBanner() {
  const target = nextSunday20()
  const countdown = useCountdown(target)
  return (
    <motion.div
      initial={{ y: -8, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="mb-5 rounded-2xl overflow-hidden relative"
      style={{
        background: 'linear-gradient(135deg, #1e1a0e 0%, #2a2210 50%, #1a1608 100%)',
        border: '1px solid rgba(212,168,67,0.35)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 0 30px rgba(212,168,67,0.08)',
      }}
    >
      {/* Corner decorations */}
      <div className="absolute top-0 left-0 w-16 h-16 opacity-10"
        style={{ background: 'radial-gradient(circle at 0 0, #d4a843, transparent)' }} />
      <div className="absolute bottom-0 right-0 w-16 h-16 opacity-10"
        style={{ background: 'radial-gradient(circle at 100% 100%, #d4a843, transparent)' }} />

      <div className="px-5 py-4 relative z-10">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="text-[10px] font-bold tracking-[0.2em] text-poker-gold/60 uppercase mb-1">
              Главное событие
            </div>
            <h2 className="text-lg font-extrabold text-white leading-tight">
              ВОСКРЕСНЫЙ<br />
              <span className="text-poker-gold">Турнир</span>
            </h2>
            <div className="text-sm font-bold text-poker-gold mt-1">50,000 RR GTD</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-gray-600 mb-1">До начала</div>
            <div className="font-mono text-xl font-extrabold text-white tabular-nums">{countdown}</div>
          </div>
        </div>
        <div className="divider-gold mb-3" />
        <div className="flex items-center justify-between">
          <div className="flex gap-4 text-xs text-gray-500">
            <span>Бай-ин: <span className="text-white font-bold">500 RR</span></span>
            <span>Мест: <span className="text-white font-bold">200</span></span>
          </div>
          <button
            className="px-4 py-1.5 rounded-xl text-xs font-bold"
            style={{ background: 'rgba(212,168,67,0.15)', color: '#d4a843', border: '1px solid rgba(212,168,67,0.3)' }}
          >
            Зарегистрироваться
          </button>
        </div>
      </div>
    </motion.div>
  )
}

function TournamentCard({ t, index }: { t: Tournament; index: number }) {
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
      {/* Ticket notch decoration */}
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
            {isRunning ? '● Идёт' : `Старт: ${countdown}`}
          </p>
        </div>
        <span
          className="text-[10px] px-2 py-1 rounded-full font-semibold"
          style={{
            background: isRunning ? 'rgba(234,179,8,0.1)' : 'rgba(34,197,94,0.08)',
            color: isRunning ? '#eab308' : '#4ade80',
            border: `1px solid ${isRunning ? 'rgba(234,179,8,0.2)' : 'rgba(34,197,94,0.15)'}`,
          }}
        >
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
        <button className="w-full btn-gold py-2.5 text-sm">
          Зарегистрироваться {!isFree && `(${t.buy_in + t.fee} RR)`}
        </button>
      )}
    </motion.div>
  )
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
          { id: 1, name: 'Daily Freeroll',      buy_in: 0,    fee: 0,  starting_stack: 1500,  max_players: 100, current_players: 47, prize_pool: 1000,  status: 'registering', starts_at: new Date(Date.now() + 3600000).toISOString() },
          { id: 2, name: 'Evening Tournament',  buy_in: 100,  fee: 10, starting_stack: 3000,  max_players: 50,  current_players: 23, prize_pool: 2300,  status: 'registering', starts_at: new Date(Date.now() + 7200000).toISOString() },
          { id: 3, name: 'High Roller Weekly',  buy_in: 1000, fee: 50, starting_stack: 10000, max_players: 20,  current_players: 8,  prize_pool: 8000,  status: 'registering', starts_at: new Date(Date.now() + 86400000).toISOString() },
        ])
      })
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen pb-20 px-4 pt-5 relative z-10">
      <motion.h1
        initial={{ x: -16, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        className="text-xl font-extrabold mb-5 tracking-tight"
      >
        Турнирный Холл
      </motion.h1>

      <SundayBanner />

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-7 h-7 border-2 border-poker-gold border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {tournaments.map((t, i) => (
            <TournamentCard key={t.id} t={t} index={i} />
          ))}
        </div>
      )}
    </div>
  )
}
