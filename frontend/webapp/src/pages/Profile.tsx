import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useTonAddress, useTonConnectUI } from '@tonconnect/ui-react'
import { useTelegram } from '../hooks/useTelegram'
import { useStore } from '../store/useStore'
import { useApi } from '../hooks/useApi'

type ProfileTab = 'stats' | 'rewards'

interface ProfileData {
  hands_played: number
  hands_won: number
  win_rate: number
  best_hand: string | null
  total_chips_won: number
  biggest_pot_won: number
  tournaments_played: number
  tournaments_won: number
  all_ins_won: number
  xp: number
  level: number
  login_streak: number
}

interface AchievementData {
  id: number
  key: string
  name: string
  description: string | null
  icon: string | null
  rarity: string
  target: number
  xp_reward: number
  progress: number
  unlocked: boolean
  unlocked_at: string | null
}

const rarityStyle: Record<string, { border: string; bg: string; glow: string }> = {
  bronze:  { border: 'border-amber-700/40',    bg: 'bg-amber-900/20',  glow: '' },
  silver:  { border: 'border-gray-400/30',     bg: 'bg-gray-700/20',   glow: '' },
  gold:    { border: 'border-poker-gold/40',   bg: 'bg-yellow-900/20', glow: 'shadow-[0_0_12px_rgba(212,168,67,0.15)]' },
  diamond: { border: 'border-cyan-400/40',     bg: 'bg-cyan-900/20',   glow: 'shadow-[0_0_16px_rgba(34,211,238,0.15)]' },
}

// XP needed for next level
function xpForLevel(level: number) { return level * level * 100 }

export default function Profile() {
  const { user: tgUser } = useTelegram()
  const user = useStore((s) => s.user)
  const address = useTonAddress()
  const [tonConnectUI] = useTonConnectUI()
  const [tab, setTab] = useState<ProfileTab>('stats')
  const { get } = useApi()

  const [stats, setStats] = useState<ProfileData | null>(null)
  const [achievements, setAchievements] = useState<AchievementData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      get<ProfileData>('/profile/me'),
      get<AchievementData[]>('/achievements/'),
    ]).then(([profileData, achData]) => {
      setStats(profileData)
      setAchievements(achData)
    }).catch(console.error).finally(() => setLoading(false))
  }, [])

  const unlockedCount = achievements.filter((a) => a.unlocked).length
  const level = stats?.level ?? 1
  const xp = stats?.xp ?? 0
  const xpNext = xpForLevel(level)
  const xpPrev = xpForLevel(level - 1)
  const xpPct = Math.min(100, ((xp - xpPrev) / (xpNext - xpPrev)) * 100)

  return (
    <div className="min-h-screen pb-24 px-4 pt-6">
      {/* Profile header */}
      <motion.div
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="card-surface-glow p-5 mb-5"
      >
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-poker-gold/30 to-poker-gold/5 border border-poker-gold/20 flex items-center justify-center text-2xl font-bold text-poker-gold flex-shrink-0">
            {tgUser?.first_name?.[0] || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-extrabold text-lg truncate">{tgUser?.first_name || 'Player'}</h2>
            <p className="text-xs text-gray-500">@{tgUser?.username || 'anonymous'}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] text-poker-gold font-bold">Ур. {level}</span>
              <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${xpPct}%` }}
                  transition={{ duration: 0.6 }}
                  className="h-full bg-poker-gold rounded-full"
                />
              </div>
              <span className="text-[10px] text-gray-600 font-mono">{xp} XP</span>
            </div>
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
            <button onClick={() => tonConnectUI.disconnect()} className="text-[10px] text-red-400 font-medium">
              Отключить
            </button>
          </div>
        ) : (
          <button onClick={() => tonConnectUI.openModal()} className="btn-gold w-full !text-sm">
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
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          <p className="section-title">Игровая статистика</p>
          {loading ? (
            <div className="text-center text-gray-500 py-8">Загрузка...</div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Рук сыграно',    value: stats?.hands_played ?? 0,                          icon: '🃏' },
                { label: 'Рук выиграно',   value: stats?.hands_won ?? 0,                             icon: '✅' },
                { label: 'Винрейт',        value: `${stats?.win_rate ?? 0}%`,                        icon: '📈' },
                { label: 'Лучшая рука',    value: stats?.best_hand ?? '—',                           icon: '🏆' },
                { label: 'Всего выиграно', value: `${(stats?.total_chips_won ?? 0).toLocaleString()} RR`, icon: '💰' },
                { label: 'Турниров',       value: stats?.tournaments_played ?? 0,                    icon: '🏅' },
                { label: 'Олл-ин побед',   value: stats?.all_ins_won ?? 0,                           icon: '🔥' },
                { label: 'Серия входов',   value: `${stats?.login_streak ?? 0} дн.`,                 icon: '📅' },
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
          )}
        </motion.div>
      )}

      {/* Rewards tab */}
      {tab === 'rewards' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
          <p className="section-title">Достижения ({unlockedCount}/{achievements.length})</p>
          {loading ? (
            <div className="text-center text-gray-500 py-8">Загрузка...</div>
          ) : (
            achievements.map((a, i) => {
              const style = rarityStyle[a.rarity] ?? rarityStyle.bronze
              const pct = Math.min(100, (a.progress / a.target) * 100)
              return (
                <motion.div
                  key={a.key}
                  initial={{ x: -12, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className={`card-surface p-3.5 border ${style.border} ${style.glow} ${!a.unlocked ? 'opacity-70' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-xl ${style.bg} flex items-center justify-center text-xl flex-shrink-0`}>
                      {a.unlocked ? (a.icon ?? '🏆') : '🔒'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm">{a.name}</span>
                        {a.unlocked && <span className="text-emerald-400 text-xs">✓</span>}
                        <span className="text-[9px] text-poker-gold ml-auto">+{a.xp_reward} XP</span>
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
                          <span className="text-[10px] text-gray-600 font-mono">{a.progress}/{a.target}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )
            })
          )}
        </motion.div>
      )}
    </div>
  )
}
