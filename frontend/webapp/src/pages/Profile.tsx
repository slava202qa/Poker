import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useTonAddress } from '@tonconnect/ui-react'
import { useTelegram } from '../hooks/useTelegram'
import { useStore } from '../store/useStore'
import { ChipBalance } from '../components/ChipBalance'

interface ProfileData {
  total_games: number
  total_won: number
  total_deposited: number
  total_withdrawn: number
  member_since: string
}

export default function Profile() {
  const { user: tgUser } = useTelegram()
  const walletAddress = useTonAddress()
  const user = useStore((s) => s.user)
  const [stats, setStats] = useState<ProfileData | null>(null)

  // Demo stats
  useEffect(() => {
    setStats({
      total_games: 0,
      total_won: 0,
      total_deposited: 0,
      total_withdrawn: 0,
      member_since: new Date().toISOString(),
    })
  }, [])

  const statItems = [
    { label: 'Игр сыграно', value: stats?.total_games ?? 0, icon: '🃏' },
    { label: 'Выиграно', value: `${(stats?.total_won ?? 0).toFixed(0)} CHIP`, icon: '💰' },
    { label: 'Депозиты', value: `${(stats?.total_deposited ?? 0).toFixed(0)} CHIP`, icon: '📥' },
    { label: 'Выводы', value: `${(stats?.total_withdrawn ?? 0).toFixed(0)} CHIP`, icon: '📤' },
  ]

  return (
    <div className="min-h-screen pb-20 px-4 pt-6">
      <motion.h1
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        className="text-2xl font-bold mb-6"
      >
        👤 Профиль
      </motion.h1>

      {/* User card */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="card-surface p-5 mb-6"
      >
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-poker-gold to-yellow-600 flex items-center justify-center text-2xl font-bold text-poker-darker">
            {(tgUser?.first_name?.[0] || 'P').toUpperCase()}
          </div>
          <div>
            <h2 className="font-bold text-lg">{tgUser?.first_name || 'Player'}</h2>
            {tgUser?.username && (
              <p className="text-gray-500 text-sm">@{tgUser.username}</p>
            )}
            <p className="text-gray-600 text-xs mt-0.5">ID: {tgUser?.id || '—'}</p>
          </div>
        </div>

        <div className="flex items-center justify-between p-3 bg-poker-darker rounded-xl">
          <span className="text-gray-400 text-sm">Баланс</span>
          <ChipBalance amount={user?.balance ?? 0} />
        </div>

        {walletAddress && (
          <div className="mt-3 p-3 bg-poker-darker rounded-xl">
            <p className="text-gray-500 text-xs mb-1">TON Кошелёк</p>
            <p className="text-xs text-gray-300 font-mono truncate">{walletAddress}</p>
          </div>
        )}
      </motion.div>

      {/* Stats */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <h3 className="font-bold text-sm text-gray-400 mb-3 uppercase tracking-wider">Статистика</h3>
        <div className="grid grid-cols-2 gap-3">
          {statItems.map((item, i) => (
            <motion.div
              key={item.label}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.15 + i * 0.05 }}
              className="card-surface p-4 text-center"
            >
              <span className="text-xl">{item.icon}</span>
              <p className="font-bold text-poker-gold mt-1">{item.value}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">{item.label}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Member since */}
      {stats?.member_since && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-center text-xs text-gray-600 mt-6"
        >
          Участник с {new Date(stats.member_since).toLocaleDateString('ru-RU')}
        </motion.p>
      )}
    </div>
  )
}
