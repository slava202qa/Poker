import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useTonConnectUI, useTonAddress } from '@tonconnect/ui-react'
import { useTelegram } from '../hooks/useTelegram'
import { useStore } from '../store/useStore'
import { useApi } from '../hooks/useApi'

interface SeasonProgress {
  season_name: string
  total_levels: number
  current_level: number
  current_xp: number
  xp_per_level: number
  progress_pct: number
  ends_at: string
}

export default function Home() {
  const navigate = useNavigate()
  const { user: tgUser } = useTelegram()
  const user = useStore((s) => s.user)
  const address = useTonAddress()
  const [tonConnectUI] = useTonConnectUI()
  const { get } = useApi()
  const [season, setSeason] = useState<SeasonProgress | null>(null)

  useEffect(() => {
    get<SeasonProgress>('/battlepass/season').then(setSeason).catch(() => {})
  }, [])

  const daysLeft = season
    ? Math.max(0, Math.ceil((new Date(season.ends_at).getTime() - Date.now()) / 86400000))
    : null

  return (
    <div className="min-h-screen pb-24 px-4 pt-6 space-y-4">

      {/* Header */}
      <motion.div
        initial={{ y: -12, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            Royal <span className="text-poker-gold">Roll</span>
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Привет, {tgUser?.first_name || 'игрок'} 👋
          </p>
        </div>
        <motion.div
          animate={{ rotate: [0, 5, -5, 0] }}
          transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
          className="text-3xl"
        >
          🎰
        </motion.div>
      </motion.div>

      {/* Double wallet */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.05 }}
        className="grid grid-cols-2 gap-3"
      >
        {/* Real RR */}
        <div className="card-surface-glow p-4 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-poker-gold/5 to-transparent pointer-events-none" />
          <div className="text-[10px] text-gray-500 mb-1 font-medium uppercase tracking-wider">
            💰 Real RR
          </div>
          <div className="text-2xl font-extrabold text-poker-gold tabular-nums">
            {(user?.balance ?? 0).toLocaleString()}
          </div>
          <div className="text-[10px] text-gray-600 mt-0.5">Игровые активы</div>
        </div>
        {/* Bonus RR */}
        <div className="card-surface p-4 relative overflow-hidden border border-blue-500/10">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent pointer-events-none" />
          <div className="text-[10px] text-gray-500 mb-1 font-medium uppercase tracking-wider">
            🎁 Bonus RR
          </div>
          <div className="text-2xl font-extrabold text-blue-400 tabular-nums">
            {(user?.fun_balance ?? 0).toLocaleString()}
          </div>
          <div className="text-[10px] text-gray-600 mt-0.5">Бонусные награды</div>
        </div>
      </motion.div>

      {/* Battle Pass season card */}
      {season && (
        <motion.div
          initial={{ y: 8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="card-surface p-4 border border-poker-gold/10"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">🏆</span>
              <div>
                <div className="text-sm font-bold">{season.season_name}</div>
                <div className="text-[10px] text-gray-500">Осталось {daysLeft} дн.</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs font-bold text-poker-gold">Ур. {season.current_level}</div>
              <div className="text-[10px] text-gray-500">из {season.total_levels}</div>
            </div>
          </div>
          {/* XP bar */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-white/[0.06] rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${season.progress_pct}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="h-full bg-gradient-to-r from-poker-gold to-yellow-400 rounded-full"
              />
            </div>
            <span className="text-[10px] text-gray-500 font-mono w-16 text-right">
              {season.current_xp}/{season.xp_per_level} XP
            </span>
          </div>
          <button
            onClick={() => navigate('/profile')}
            className="mt-2 text-[10px] text-poker-gold/70 hover:text-poker-gold transition-colors"
          >
            Посмотреть награды →
          </button>
        </motion.div>
      )}

      {/* Main PLAY button */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.15, type: 'spring', stiffness: 200 }}
        className="relative"
      >
        {/* Glow pulse behind button */}
        <motion.div
          animate={{ scale: [1, 1.08, 1], opacity: [0.4, 0.7, 0.4] }}
          transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
          className="absolute inset-0 rounded-2xl bg-poker-gold/20 blur-xl pointer-events-none"
        />
        <motion.button
          whileTap={{ scale: 0.96 }}
          whileHover={{ scale: 1.02 }}
          onClick={() => navigate('/tables')}
          className="relative w-full py-5 rounded-2xl font-extrabold text-xl tracking-wide overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #d4a843 0%, #f0d078 40%, #d4a843 70%, #a07820 100%)',
            boxShadow: '0 0 30px rgba(212,168,67,0.4), 0 4px 20px rgba(0,0,0,0.5)',
            color: '#1a0f00',
          }}
        >
          {/* Shimmer sweep */}
          <motion.div
            animate={{ x: ['-100%', '200%'] }}
            transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut', repeatDelay: 1 }}
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12 pointer-events-none"
          />
          <span className="relative z-10 flex items-center justify-center gap-3">
            <span>🎰</span>
            <span>ИГРАТЬ</span>
            <span>🃏</span>
          </span>
        </motion.button>
      </motion.div>

      {/* Quick actions */}
      <motion.div
        initial={{ y: 8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-3 gap-2"
      >
        {[
          { icon: '🏆', label: 'Турниры',  path: '/tournaments' },
          { icon: '🛍',  label: 'Сумка',    path: '/shop'        },
          { icon: '👤',  label: 'Профиль',  path: '/profile'     },
        ].map((item, i) => (
          <motion.button
            key={item.path}
            whileTap={{ scale: 0.94 }}
            onClick={() => navigate(item.path)}
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.22 + i * 0.05 }}
            className="card-surface p-4 flex flex-col items-center gap-2 hover:border-poker-gold/20 transition-colors"
          >
            <span className="text-2xl">{item.icon}</span>
            <span className="text-xs text-gray-400 font-medium">{item.label}</span>
          </motion.button>
        ))}
      </motion.div>

      {/* Wallet block */}
      <motion.div
        initial={{ y: 8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="card-surface p-4"
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-bold">💎 TON Кошелёк</span>
          {address && (
            <span className="text-[10px] text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Подключён
            </span>
          )}
        </div>
        {address ? (
          <div className="space-y-2">
            <div className="bg-white/[0.03] rounded-xl p-3 font-mono text-xs text-gray-400 truncate">
              {address}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => navigate('/shop')}
                className="btn-gold !py-2 !text-xs !rounded-xl"
              >
                Пополнить
              </button>
              <button
                onClick={() => tonConnectUI.disconnect()}
                className="bg-white/[0.05] border border-white/[0.08] text-gray-400 text-xs py-2 rounded-xl font-medium hover:text-white transition-colors"
              >
                Отключить
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => tonConnectUI.openModal()}
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-3 text-sm text-gray-300 font-medium hover:border-poker-gold/30 hover:text-white transition-all"
          >
            🔗 Подключить кошелёк
          </button>
        )}
      </motion.div>

      {/* Info cards */}
      <motion.div
        initial={{ y: 8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.35 }}
        className="grid grid-cols-2 gap-3"
      >
        <div className="card-surface p-4">
          <div className="text-lg mb-1">🔄</div>
          <div className="text-xs font-bold mb-0.5">Обмен активов</div>
          <div className="text-[10px] text-gray-500 leading-relaxed">
            Пополни через бота командой /buy
          </div>
        </div>
        <div className="card-surface p-4">
          <div className="text-lg mb-1">🎁</div>
          <div className="text-xs font-bold mb-0.5">Ежедневные награды</div>
          <div className="text-[10px] text-gray-500 leading-relaxed">
            Заходи каждый день за бонусом
          </div>
        </div>
      </motion.div>

      {/* Terms */}
      <p className="text-center text-[10px] text-gray-700 pb-2">
        Используя приложение, вы соглашаетесь с{' '}
        <button
          onClick={() => navigate('/terms')}
          className="text-gray-500 underline underline-offset-2"
        >
          Условиями использования
        </button>
        . Все фишки виртуальны и не имеют денежной стоимости.
      </p>
    </div>
  )
}
