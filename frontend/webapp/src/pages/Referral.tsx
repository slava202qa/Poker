import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useApi } from '../hooks/useApi'

interface ReferralStats {
  ref_code: string
  invite_url: string
  invited_count: number
  earned_rr: number
  pending_rr: number
  bonus_per_friend: number
  welcome_bonus: number
}

export default function Referral() {
  const api = useApi()
  const [stats, setStats] = useState<ReferralStats | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    api.get<ReferralStats>('/referral/stats').then(setStats).catch(() => {})
  }, [])

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
        <h1 className="text-xl font-extrabold text-poker-gold tracking-wide">Пригласи друга</h1>
        <p className="text-xs text-gray-500 mt-1">
          Ты получаешь <span className="text-poker-gold font-bold">{stats?.bonus_per_friend ?? 500} RR</span> после первого пополнения друга.
          Друг получает <span className="text-white font-bold">{stats?.welcome_bonus ?? 100} RR</span> сразу.
        </p>
      </motion.div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="grid grid-cols-2 gap-3 mb-4"
      >
        <div className="card-surface p-4 text-center rounded-2xl">
          <div className="text-2xl font-extrabold text-white">{stats?.invited_count ?? 0}</div>
          <div className="text-[11px] text-gray-500 mt-1">Приглашено друзей</div>
        </div>
        <div className="card-surface p-4 text-center rounded-2xl">
          <div className="text-2xl font-extrabold text-poker-gold">
            {(stats?.earned_rr ?? 0).toLocaleString()}
          </div>
          <div className="text-[11px] text-gray-500 mt-1">Заработано RR</div>
        </div>
      </motion.div>

      {/* Pending bonus */}
      {(stats?.pending_rr ?? 0) > 0 && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="rounded-2xl p-3 mb-4 flex items-center gap-3"
          style={{ background: 'rgba(212,168,67,0.06)', border: '1px solid rgba(212,168,67,0.2)' }}
        >
          <span className="text-xl">⏳</span>
          <div>
            <p className="text-xs font-bold text-poker-gold">{stats!.pending_rr} RR ожидают выплаты</p>
            <p className="text-[10px] text-gray-500">Начислятся после первого пополнения друга</p>
          </div>
        </motion.div>
      )}

      {/* Invite link */}
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        className="card-surface rounded-2xl p-4 mb-4"
      >
        <p className="text-[11px] text-gray-500 mb-2 font-medium">Твоя реферальная ссылка</p>
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
        <span>Пригласить друга в Telegram</span>
      </motion.button>

      {/* How it works */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
        className="mt-6 card-surface rounded-2xl p-4"
      >
        <p className="text-xs font-bold text-white mb-3">Как это работает</p>
        {[
          { icon: '🔗', text: 'Поделись своей ссылкой с другом' },
          { icon: '🎁', text: `Друг получает ${stats?.welcome_bonus ?? 100} RR сразу при регистрации` },
          { icon: '💰', text: `Ты получаешь ${stats?.bonus_per_friend ?? 500} RR после первого пополнения друга` },
          { icon: '♾️', text: 'Количество приглашений не ограничено' },
        ].map((item, i) => (
          <div key={i} className="flex items-center gap-3 py-2 border-b last:border-0"
            style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
            <span className="text-lg w-7 text-center flex-shrink-0">{item.icon}</span>
            <span className="text-xs text-gray-400">{item.text}</span>
          </div>
        ))}
      </motion.div>

    </div>
  )
}
