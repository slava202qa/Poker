import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useApi } from '../../hooks/useApi'

interface Stats {
  total_users: number
  active_today: number
  total_tables: number
  active_tables: number
  total_tournaments: number
  total_rake: number
  rake_today: number
  rake_week: number
  rake_month: number
  total_deposited: number
  total_withdrawn: number
  system_balance: number
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const api = useApi()

  useEffect(() => {
    api.get<Stats>('/admin/stats').then(setStats).catch(() => {})
  }, [])

  if (!stats) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-poker-gold border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const cards = [
    { label: 'Всего игроков', value: stats.total_users, icon: '👥', color: 'text-blue-400' },
    { label: 'Активных сегодня', value: stats.active_today, icon: '🟢', color: 'text-green-400' },
    { label: 'Столов', value: `${stats.active_tables}/${stats.total_tables}`, icon: '🃏', color: 'text-purple-400' },
    { label: 'Турниров', value: stats.total_tournaments, icon: '🏆', color: 'text-yellow-400' },
  ]

  const rakeCards = [
    { label: 'Рейк сегодня', value: stats.rake_today },
    { label: 'Рейк за неделю', value: stats.rake_week },
    { label: 'Рейк за месяц', value: stats.rake_month },
    { label: 'Рейк всего', value: stats.total_rake },
  ]

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">📊 Обзор</h2>

      {/* Main stats */}
      <div className="grid grid-cols-2 gap-3">
        {cards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: i * 0.05 }}
            className="card-surface p-4"
          >
            <div className="flex items-center gap-2 mb-1">
              <span>{card.icon}</span>
              <span className="text-xs text-gray-500">{card.label}</span>
            </div>
            <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Rake stats */}
      <div>
        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Рейк (CHIP)</h3>
        <div className="grid grid-cols-2 gap-3">
          {rakeCards.map((card, i) => (
            <motion.div
              key={card.label}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 + i * 0.05 }}
              className="card-surface p-4"
            >
              <p className="text-xs text-gray-500 mb-1">{card.label}</p>
              <p className="text-lg font-bold text-poker-gold">{card.value.toFixed(2)}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Financial overview */}
      <div>
        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Финансы</h3>
        <div className="card-surface p-4 space-y-3">
          <div className="flex justify-between">
            <span className="text-gray-400">Всего депозитов</span>
            <span className="text-green-400 font-bold">{stats.total_deposited.toFixed(2)} CHIP</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Всего выводов</span>
            <span className="text-red-400 font-bold">{stats.total_withdrawn.toFixed(2)} CHIP</span>
          </div>
          <div className="border-t border-poker-border pt-3 flex justify-between">
            <span className="text-gray-400">Балансы игроков</span>
            <span className="text-poker-gold font-bold">{stats.system_balance.toFixed(2)} CHIP</span>
          </div>
        </div>
      </div>
    </div>
  )
}
