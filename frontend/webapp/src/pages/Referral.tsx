import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useApi } from '../hooks/useApi'
import { useStore } from '../store/useStore'

interface Agent {
  telegram_id: number
  username: string | null
  first_name: string
  joined_at: string
  deposit_made: boolean
}

interface ReferralStats {
  ref_code: string
  invite_url: string
  invited_count: number
  earned_rr: number
  pending_rr: number
  bonus_balance: number
  bonus_per_friend: number
  welcome_bonus: number
  agents: Agent[]
}

export default function Referral() {
  const api = useApi()
  const setUser = useStore((s) => s.setUser)
  const user = useStore((s) => s.user)
  const [stats, setStats] = useState<ReferralStats | null>(null)
  const [copied, setCopied] = useState(false)
  const [claiming, setClaiming] = useState(false)
  const [claimMsg, setClaimMsg] = useState('')

  useEffect(() => {
    api.get<ReferralStats>('/referral/stats').then(setStats).catch(() => {})
  }, [])

  async function handleClaim() {
    setClaiming(true)
    setClaimMsg('')
    try {
      const res = await api.post<{ claimed: number; new_balance: number }>('/referral/claim')
      setClaimMsg(`✅ +${res.claimed.toFixed(2)} RR зачислено на баланс!`)
      if (user) setUser({ ...user, balance: res.new_balance })
      setStats(s => s ? { ...s, bonus_balance: 0 } : s)
    } catch (e: any) {
      setClaimMsg(`❌ ${e?.detail || 'Ошибка'}`)
    } finally {
      setClaiming(false)
    }
  }

  function handleShare() {
    if (!stats) return
    const tgShare = `https://t.me/share/url?url=${encodeURIComponent(stats.invite_url)}&text=${encodeURIComponent('🃏 Вступай в закрытый покерный клуб Royal Roll! По моей ссылке получишь ' + stats.welcome_bonus + ' RR на счёт сразу!')}`
    window.open(tgShare, '_blank')
  }

  function handleCopy() {
    if (!stats) return
    navigator.clipboard.writeText(stats.invite_url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="min-h-screen pb-24 px-4 pt-5">

      <motion.div initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="mb-6">
        <h1 className="text-xl font-extrabold text-poker-gold tracking-wide">🤝 Синдикат</h1>
        <p className="text-xs text-gray-500 mt-1">
          Вербуй агентов — получай долю с их игры. Ты получаешь <span className="text-poker-gold font-bold">{stats?.bonus_per_friend ?? 500} RR</span> после первого пополнения агента.
          Агент получает <span className="text-white font-bold">{stats?.welcome_bonus ?? 100} RR</span> сразу при вступлении.
        </p>
      </motion.div>

      {/* Stats grid */}
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="grid grid-cols-2 gap-3 mb-4"
      >
        <div className="card-surface p-4 text-center rounded-2xl">
          <div className="text-2xl font-extrabold text-white">{stats?.invited_count ?? 0}</div>
          <div className="text-[11px] text-gray-500 mt-1">Агентов завербовано</div>
        </div>
        <div className="card-surface p-4 text-center rounded-2xl">
          <div className="text-2xl font-extrabold text-poker-gold">
            {(stats?.earned_rr ?? 0).toLocaleString()}
          </div>
          <div className="text-[11px] text-gray-500 mt-1">Доход Синдиката</div>
        </div>
      </motion.div>

      {/* Bonus balance — claim button */}
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
        className="rounded-2xl p-4 mb-4"
        style={{ background: 'rgba(212,168,67,0.06)', border: '1px solid rgba(212,168,67,0.2)' }}
      >
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-xs text-gray-500">Накоплено от рейка агентов</p>
            <p className="text-xl font-extrabold text-poker-gold">
              {(stats?.bonus_balance ?? 0).toFixed(2)} RR
            </p>
          </div>
          <button
            onClick={handleClaim}
            disabled={claiming || (stats?.bonus_balance ?? 0) <= 0}
            className="px-4 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-40"
            style={{ background: 'rgba(212,168,67,0.15)', border: '1px solid rgba(212,168,67,0.35)', color: '#d4a843' }}
          >
            {claiming ? '...' : 'Получить'}
          </button>
        </div>
        {claimMsg && <p className="text-xs mt-1" style={{ color: claimMsg.startsWith('✅') ? '#4ade80' : '#f87171' }}>{claimMsg}</p>}
        <div className="flex gap-3 mt-2">
          <span className="text-[10px] text-gray-600">Ур.1: 10% рейка</span>
          <span className="text-[10px] text-gray-600">·</span>
          <span className="text-[10px] text-gray-600">Ур.2: 3% рейка</span>
        </div>
      </motion.div>

      {/* Pending bonus */}
      {(stats?.pending_rr ?? 0) > 0 && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="rounded-2xl p-3 mb-4 flex items-center gap-3"
          style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)' }}
        >
          <span className="text-xl">⏳</span>
          <div>
            <p className="text-xs font-bold text-indigo-400">{stats!.pending_rr} RR ожидают выплаты</p>
            <p className="text-[10px] text-gray-500">Начислятся после первого пополнения агента</p>
          </div>
        </motion.div>
      )}

      {/* Invite link */}
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        className="card-surface rounded-2xl p-4 mb-4"
      >
        <p className="text-[11px] text-gray-500 mb-2 font-medium">Твоя ссылка Синдиката</p>
        <div className="flex items-center gap-2">
          <div
            className="flex-1 rounded-xl px-3 py-2.5 text-xs font-mono truncate"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#9ca3af' }}
          >
            {stats?.invite_url ?? '...'}
          </div>
          <button
            onClick={handleCopy}
            className="flex-shrink-0 px-3 py-2.5 rounded-xl text-xs font-bold transition-all"
            style={{
              background: copied ? 'rgba(34,197,94,0.12)' : 'rgba(212,168,67,0.1)',
              border: copied ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(212,168,67,0.25)',
              color: copied ? '#4ade80' : '#d4a843',
            }}
          >
            {copied ? '✓' : 'Копировать'}
          </button>
        </div>
      </motion.div>

      {/* Share button */}
      <motion.button
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        onClick={handleShare}
        className="btn-gold w-full py-4 text-sm font-bold rounded-2xl flex items-center justify-center gap-2"
      >
        <span>✈️</span>
        <span>Завербовать агента в Telegram</span>
      </motion.button>

      {/* How it works */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
        className="mt-6 card-surface rounded-2xl p-4"
      >
        <p className="text-xs font-bold text-white mb-3">Как работает Синдикат</p>
        {[
          { icon: '🔗', text: 'Поделись своей ссылкой — завербуй агента' },
          { icon: '🎁', text: `Агент получает ${stats?.welcome_bonus ?? 100} RR сразу при вступлении` },
          { icon: '💰', text: `Ты получаешь ${stats?.bonus_per_friend ?? 500} RR после первого пополнения агента` },
          { icon: '🎰', text: 'Агент получает +5% к первому депозиту автоматически' },
          { icon: '📊', text: 'Уровень 1: 10% от рейка твоих агентов → в копилку' },
          { icon: '📈', text: 'Уровень 2: 3% от рейка агентов твоих агентов → в копилку' },
          { icon: '♾️', text: 'Количество агентов не ограничено' },
        ].map((item, i) => (
          <div key={i} className="flex items-center gap-3 py-2 border-b last:border-0"
            style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
            <span className="text-lg w-7 text-center flex-shrink-0">{item.icon}</span>
            <span className="text-xs text-gray-400">{item.text}</span>
          </div>
        ))}
      </motion.div>

      {/* Agents list */}
      {(stats?.agents?.length ?? 0) > 0 && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}
          className="mt-4 card-surface rounded-2xl p-4"
        >
          <p className="text-xs font-bold text-white mb-3">Мои агенты ({stats!.agents.length})</p>
          <div className="space-y-2">
            {stats!.agents.map((agent) => (
              <div key={agent.telegram_id} className="flex items-center justify-between py-2 border-b last:border-0"
                style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ background: 'rgba(212,168,67,0.1)', color: '#d4a843' }}>
                    {agent.first_name[0]?.toUpperCase() ?? '?'}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-white">{agent.first_name}{agent.username ? ` @${agent.username}` : ''}</p>
                    <p className="text-[10px] text-gray-600">{new Date(agent.joined_at).toLocaleDateString('ru-RU')}</p>
                  </div>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${agent.deposit_made ? 'text-green-400' : 'text-gray-600'}`}
                  style={{ background: agent.deposit_made ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.04)' }}>
                  {agent.deposit_made ? '✓ Активен' : 'Ожидание'}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

    </div>
  )
}
