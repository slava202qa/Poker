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

const RARITY: Record<string, { border: string; glow: string; label: string; color: string }> = {
  bronze:  { border: 'rgba(180,100,30,0.3)',  glow: '',                                    label: 'Bronze',  color: '#cd7f32' },
  silver:  { border: 'rgba(180,180,180,0.25)', glow: '',                                    label: 'Silver',  color: '#c0c0c0' },
  gold:    { border: 'rgba(212,168,67,0.35)',  glow: '0 0 14px rgba(212,168,67,0.12)',      label: 'Gold',    color: '#d4a843' },
  diamond: { border: 'rgba(34,211,238,0.35)',  glow: '0 0 14px rgba(34,211,238,0.12)',      label: 'Diamond', color: '#22d3ee' },
}

// Title tiers by level
function getTitle(level: number): string {
  if (level >= 40) return 'Legend'
  if (level >= 30) return 'Master'
  if (level >= 20) return 'Expert'
  if (level >= 10) return 'Veteran'
  if (level >= 5)  return 'Member'
  return 'Genesis'
}

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
    ]).then(([p, a]) => { setStats(p); setAchievements(a) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const unlockedCount = achievements.filter((a) => a.unlocked).length
  const level = stats?.level ?? 1
  const xp = stats?.xp ?? 0
  const xpNext = xpForLevel(level)
  const xpPrev = xpForLevel(level - 1)
  const xpPct = Math.min(100, ((xp - xpPrev) / Math.max(1, xpNext - xpPrev)) * 100)
  const title = getTitle(level)

  return (
    <div className="min-h-screen pb-24 px-4 pt-5 relative z-10">

      {/* ── Club Member Card ── */}
      <motion.div
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="mb-5 rounded-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #1a1608 0%, #1c1c1c 50%, #0f0f0f 100%)',
          border: '1px solid rgba(212,168,67,0.25)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 0 40px rgba(212,168,67,0.06)',
        }}
      >
        {/* Card header strip */}
        <div className="px-5 pt-4 pb-3 flex items-center justify-between"
          style={{ borderBottom: '1px solid rgba(212,168,67,0.1)' }}>
          <span className="text-[10px] font-bold tracking-[0.2em] text-poker-gold/60 uppercase">
            Royal Roll · Клубная Карта
          </span>
          <span className="text-[10px] text-gray-600">#{user?.telegram_id ?? '—'}</span>
        </div>

        <div className="px-5 py-4">
          <div className="flex items-center gap-4 mb-4">
            {/* Gold-framed avatar */}
            <div className="relative flex-shrink-0">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-extrabold"
                style={{
                  background: 'linear-gradient(135deg, #2a2210, #1a1608)',
                  border: '2px solid #d4a843',
                  boxShadow: '0 0 16px rgba(212,168,67,0.3), inset 0 1px 0 rgba(212,168,67,0.2)',
                  color: '#d4a843',
                }}
              >
                {tgUser?.first_name?.[0]?.toUpperCase() || '?'}
              </div>
              {/* Title badge */}
              <div
                className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[9px] font-bold whitespace-nowrap"
                style={{ background: '#d4a843', color: '#0a0a0a' }}
              >
                {title}
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <h2 className="font-extrabold text-lg truncate">{tgUser?.first_name || 'Player'}</h2>
              {tgUser?.username && (
                <p className="text-xs text-gray-600">@{tgUser.username}</p>
              )}
              {/* XP bar */}
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[10px] text-poker-gold font-bold w-10">Ур.{level}</span>
                <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${xpPct}%` }}
                    transition={{ duration: 0.7 }}
                    className="h-full rounded-full"
                    style={{ background: 'linear-gradient(90deg, #c49a30, #f0d078)' }}
                  />
                </div>
                <span className="text-[10px] text-gray-600 font-mono">{xp} XP</span>
              </div>
            </div>
          </div>

          {/* Balances row */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { label: 'RR Активы',  value: (user?.balance ?? 0).toLocaleString(),    color: '#d4a843' },
              { label: 'BR Баллы',   value: (user?.fun_balance ?? 0).toLocaleString(), color: '#818cf8' },
              { label: 'Достижений', value: `${unlockedCount}/${achievements.length}`, color: '#ffffff' },
            ].map((item) => (
              <div key={item.label} className="rounded-xl p-2.5 text-center"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="font-bold text-sm" style={{ color: item.color }}>{item.value}</div>
                <div className="text-[9px] text-gray-600 mt-0.5">{item.label}</div>
              </div>
            ))}
          </div>

          {/* TON Wallet */}
          {address ? (
            <div className="rounded-xl p-3 flex items-center gap-2"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              {/* TON logo */}
              <svg width="16" height="16" viewBox="0 0 56 56" fill="none" className="flex-shrink-0">
                <circle cx="28" cy="28" r="28" fill="#0098EA"/>
                <path d="M37.5 15H18.5C15.4 15 13.5 18.4 15.1 21L26.4 41.5C27.1 42.8 28.9 42.8 29.6 41.5L40.9 21C42.5 18.4 40.6 15 37.5 15Z" fill="white"/>
              </svg>
              <span className="text-xs text-gray-500 truncate flex-1 font-mono">{address}</span>
              <button onClick={() => tonConnectUI.disconnect()} className="text-[10px] text-red-500 font-medium flex-shrink-0">
                Отключить
              </button>
            </div>
          ) : (
            <button
              onClick={() => tonConnectUI.openModal()}
              className="w-full rounded-xl py-2.5 text-sm font-medium transition-all flex items-center justify-center gap-2"
              style={{ background: 'rgba(0,152,234,0.1)', border: '1px solid rgba(0,152,234,0.25)', color: '#0098EA' }}
            >
              <svg width="16" height="16" viewBox="0 0 56 56" fill="none">
                <circle cx="28" cy="28" r="28" fill="#0098EA"/>
                <path d="M37.5 15H18.5C15.4 15 13.5 18.4 15.1 21L26.4 41.5C27.1 42.8 28.9 42.8 29.6 41.5L40.9 21C42.5 18.4 40.6 15 37.5 15Z" fill="white"/>
              </svg>
              Подключить кошелёк TON
            </button>
          )}
        </div>
      </motion.div>

      {/* ── Tab switcher ── */}
      <div className="flex gap-1.5 mb-5 rounded-2xl p-1.5" style={{ background: 'rgba(255,255,255,0.03)' }}>
        {([
          { key: 'stats' as ProfileTab,   label: '📊 Статистика' },
          { key: 'rewards' as ProfileTab, label: '🏆 Достижения' },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all relative"
            style={{ color: tab === t.key ? 'white' : '#6b7280' }}
          >
            {tab === t.key && (
              <motion.div
                layoutId="profile-tab"
                className="absolute inset-0 rounded-xl"
                style={{ background: '#1c1c1c', border: '1px solid rgba(255,255,255,0.08)' }}
              />
            )}
            <span className="relative z-10">{t.label}</span>
          </button>
        ))}
      </div>

      {/* ── Stats ── */}
      {tab === 'stats' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          <p className="section-title">Игровая статистика</p>
          {loading ? (
            <div className="text-center text-gray-600 py-8">Загрузка...</div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Сыграно раздач',  value: stats?.hands_played ?? 0,                              icon: '🃏' },
                { label: 'Победы',          value: stats?.hands_won ?? 0,                                 icon: '✅' },
                { label: 'Винрейт',         value: `${stats?.win_rate ?? 0}%`,                            icon: '📈' },
                { label: 'Лучшая рука',     value: stats?.best_hand ?? '—',                               icon: '🏆' },
                { label: 'Всего выиграно',  value: `${(stats?.total_chips_won ?? 0).toLocaleString()} RR`, icon: '💰' },
                { label: 'Турниров',        value: stats?.tournaments_played ?? 0,                        icon: '🏅' },
                { label: 'Олл-ин побед',    value: stats?.all_ins_won ?? 0,                               icon: '🔥' },
                { label: 'Серия входов',    value: `${stats?.login_streak ?? 0} дн.`,                     icon: '📅' },
              ].map((s, i) => (
                <motion.div
                  key={s.label}
                  initial={{ scale: 0.92, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: i * 0.04 }}
                  className="card-surface p-4"
                >
                  <div className="text-lg mb-1">{s.icon}</div>
                  <div className="font-bold text-sm">{s.value}</div>
                  <div className="text-[10px] text-gray-600 mt-0.5">{s.label}</div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* ── Achievements ── */}
      {tab === 'rewards' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
          <p className="section-title">Достижения ({unlockedCount}/{achievements.length})</p>
          {loading ? (
            <div className="text-center text-gray-600 py-8">Загрузка...</div>
          ) : (
            achievements.map((a, i) => {
              const r = RARITY[a.rarity] ?? RARITY.bronze
              const pct = Math.min(100, (a.progress / Math.max(1, a.target)) * 100)
              return (
                <motion.div
                  key={a.key}
                  initial={{ x: -10, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className="rounded-2xl p-3.5"
                  style={{
                    background: '#1c1c1c',
                    border: `1px solid ${r.border}`,
                    boxShadow: r.glow || undefined,
                    opacity: a.unlocked ? 1 : 0.65,
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                      style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${r.border}` }}>
                      {a.unlocked ? (a.icon ?? '🏆') : '🔒'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm">{a.name}</span>
                        {a.unlocked && <span className="text-emerald-400 text-xs">✓</span>}
                        <span className="text-[9px] ml-auto font-bold" style={{ color: r.color }}>
                          +{a.xp_reward} XP
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-600">{a.description}</p>
                      {!a.unlocked && (
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ delay: i * 0.04, duration: 0.5 }}
                              className="h-full rounded-full"
                              style={{ background: r.color }}
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
