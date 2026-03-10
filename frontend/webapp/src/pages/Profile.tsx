import { useState } from 'react'
import { motion } from 'framer-motion'
import { useTonAddress, useTonConnectUI } from '@tonconnect/ui-react'
import { useTelegram } from '../hooks/useTelegram'
import { useStore } from '../store/useStore'
import { ChipBalance } from '../components/ChipBalance'

type ProfileTab = 'stats' | 'rewards'

interface Achievement {
  id: string
  icon: string
  name: string
  description: string
  progress: number
  max: number
  unlocked: boolean
  rarity: 'bronze' | 'silver' | 'gold' | 'diamond'
}

const achievements: Achievement[] = [
  { id: 'first_hand', icon: '🃏', name: 'Первая раздача', description: 'Сыграйте первую руку', progress: 1, max: 1, unlocked: true, rarity: 'bronze' },
  { id: 'first_win', icon: '🏆', name: 'Первая победа', description: 'Выиграйте раздачу', progress: 1, max: 1, unlocked: true, rarity: 'bronze' },
  { id: 'hands_100', icon: '🎯', name: 'Сотня', description: 'Сыграйте 100 рук', progress: 47, max: 100, unlocked: false, rarity: 'silver' },
  { id: 'hands_1000', icon: '⚡', name: 'Тысячник', description: 'Сыграйте 1000 рук', progress: 47, max: 1000, unlocked: false, rarity: 'gold' },
  { id: 'royal_flush', icon: '👑', name: 'Роял Флеш', description: 'Соберите Royal Flush', progress: 0, max: 1, unlocked: false, rarity: 'diamond' },
  { id: 'bluff_master', icon: '😏', name: 'Мастер блефа', description: 'Выиграйте 10 рук без шоудауна', progress: 3, max: 10, unlocked: false, rarity: 'silver' },
  { id: 'big_pot', icon: '💰', name: 'Большой банк', description: 'Выиграйте банк 10,000+ RR', progress: 0, max: 1, unlocked: false, rarity: 'gold' },
  { id: 'tournament_win', icon: '🏅', name: 'Чемпион', description: 'Выиграйте турнир', progress: 0, max: 1, unlocked: false, rarity: 'gold' },
  { id: 'all_in_win', icon: '🔥', name: 'Ва-банк!', description: 'Выиграйте 5 олл-инов', progress: 2, max: 5, unlocked: false, rarity: 'silver' },
  { id: 'streak_5', icon: '⭐', name: 'Серия побед', description: 'Выиграйте 5 рук подряд', progress: 0, max: 1, unlocked: false, rarity: 'gold' },
]

const rarityStyle: Record<string, { border: string; bg: string; glow: string }> = {
  bronze: { border: 'border-amber-700/40', bg: 'bg-amber-900/20', glow: '' },
  silver: { border: 'border-gray-400/30', bg: 'bg-gray-700/20', glow: '' },
  gold: { border: 'border-poker-gold/40', bg: 'bg-yellow-900/20', glow: 'shadow-[0_0_12px_rgba(212,168,67,0.15)]' },
  diamond: { border: 'border-cyan-400/40', bg: 'bg-cyan-900/20', glow: 'shadow-[0_0_16px_rgba(34,211,238,0.15)]' },
}

export default function Profile() {
  const { user: tgUser } = useTelegram()
  const user = useStore((s) => s.user)
  const address = useTonAddress()
  const [tonConnectUI] = useTonConnectUI()
  const [tab, setTab] = useState<ProfileTab>('stats')

  const unlockedCount = achievements.filter((a) => a.unlocked).length

  return (
    <div className="min-h-screen pb-24 px-4 pt-6">
      {/* Profile header */}
      <motion.div
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="card-surface-glow p-5 mb-5"
      >
        <div className="flex items-center gap-4 mb-4">
          {/* Avatar */}
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-poker-gold/30 to-poker-gold/5 border border-poker-gold/20 flex items-center justify-center text-2xl font-bold text-poker-gold flex-shrink-0">
            {tgUser?.first_name?.[0] || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-extrabold text-lg truncate">{tgUser?.first_name || 'Player'}</h2>
            <p className="text-xs text-gray-500">@{tgUser?.username || 'anonymous'}</p>
            <p className="text-[10px] text-gray-600 mt-0.5">ID: {tgUser?.id}</p>
          </div>
        </div>

        {/* Balances */}
        <div className="flex gap-2 mb-4">
          <div className="flex-1 bg-white/[0.03] rounded-xl p-3 text-center">
            <div className="text-[10px] text-gray-500 mb-1">Royal Roll</div>
            <div className="font-bold text-poker-gold">{(user?.balance ?? 0).toLocaleString()}</div>
          </div>
          <div className="flex-1 bg-white/[0.03] rounded-xl p-3 text-center">
            <div className="text-[10px] text-gray-500 mb-1">FUN</div>
            <div className="font-bold text-emerald-400">{(user?.fun_balance ?? 0).toLocaleString()}</div>
          </div>
          <div className="flex-1 bg-white/[0.03] rounded-xl p-3 text-center">
            <div className="text-[10px] text-gray-500 mb-1">Награды</div>
            <div className="font-bold text-white">{unlockedCount}/{achievements.length}</div>
          </div>
        </div>

        {/* Wallet */}
        {address ? (
          <div className="bg-white/[0.03] rounded-xl p-3 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-gray-400 truncate flex-1 font-mono">{address}</span>
            <button
              onClick={() => tonConnectUI.disconnect()}
              className="text-[10px] text-red-400 font-medium"
            >
              Отключить
            </button>
          </div>
        ) : (
          <button
            onClick={() => tonConnectUI.openModal()}
            className="btn-gold w-full !text-sm"
          >
            🔗 Подключить кошелёк
          </button>
        )}
      </motion.div>

      {/* Tab switcher */}
      <div className="flex gap-1.5 mb-5 bg-poker-darker/50 rounded-2xl p-1.5">
        {([
          { key: 'stats' as ProfileTab, label: '📊 Статистика' },
          { key: 'rewards' as ProfileTab, label: '🏆 Награды' },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all relative ${
              tab === t.key ? 'text-white' : 'text-gray-500'
            }`}
          >
            {tab === t.key && (
              <motion.div
                layoutId="profile-tab"
                className="absolute inset-0 bg-poker-card border border-white/[0.08] rounded-xl"
              />
            )}
            <span className="relative z-10">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Stats tab */}
      {tab === 'stats' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-3"
        >
          <p className="section-title">Игровая статистика</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Рук сыграно', value: '47', icon: '🃏' },
              { label: 'Рук выиграно', value: '18', icon: '✅' },
              { label: 'Винрейт', value: '38%', icon: '📈' },
              { label: 'Лучшая рука', value: 'Full House', icon: '🏆' },
              { label: 'Всего выиграно', value: '2,450 RR', icon: '💰' },
              { label: 'Турниров', value: '0', icon: '🏅' },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: i * 0.05 }}
                className="card-surface p-4"
              >
                <div className="text-lg mb-1">{stat.icon}</div>
                <div className="font-bold text-sm">{stat.value}</div>
                <div className="text-[10px] text-gray-500 mt-0.5">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Rewards tab */}
      {tab === 'rewards' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-2"
        >
          <p className="section-title">Достижения ({unlockedCount}/{achievements.length})</p>
          {achievements.map((a, i) => {
            const style = rarityStyle[a.rarity]
            const pct = Math.min(100, (a.progress / a.max) * 100)
            return (
              <motion.div
                key={a.id}
                initial={{ x: -12, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: i * 0.03 }}
                className={`card-surface p-3.5 border ${style.border} ${style.glow} ${
                  !a.unlocked ? 'opacity-70' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-xl ${style.bg} flex items-center justify-center text-xl flex-shrink-0`}>
                    {a.unlocked ? a.icon : '🔒'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm">{a.name}</span>
                      {a.unlocked && <span className="text-emerald-400 text-xs">✓</span>}
                    </div>
                    <p className="text-[11px] text-gray-500">{a.description}</p>
                    {!a.unlocked && (
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="flex-1 h-1 bg-white/[0.06] rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ delay: i * 0.05, duration: 0.5 }}
                            className="h-full bg-poker-gold/60 rounded-full"
                          />
                        </div>
                        <span className="text-[10px] text-gray-600 font-mono">{a.progress}/{a.max}</span>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )
          })}
        </motion.div>
      )}
    </div>
  )
}
