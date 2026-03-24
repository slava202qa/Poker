import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
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

// SVG icons for grid — inline to avoid emoji rendering differences across devices
const GridIcon = ({ type, active }: { type: string; active?: boolean }) => {
  const c = active ? '#d4a843' : '#9ca3af'
  if (type === 'tournaments') return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
      <path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
    </svg>
  )
  if (type === 'profile') return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  )
  if (type === 'shop') return (
    // Card fan — poker themed
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
      <rect x="2" y="5" width="11" height="15" rx="2" stroke={c} strokeWidth="1.8" transform="rotate(-15 7.5 12.5)"/>
      <rect x="7" y="4" width="11" height="15" rx="2" stroke={c} strokeWidth="1.8"/>
      <rect x="11" y="5" width="11" height="15" rx="2" stroke={c} strokeWidth="1.8" transform="rotate(15 16.5 12.5)"/>
      <text x="12" y="15" textAnchor="middle" fontSize="7" fill={c} fontWeight="bold">♠</text>
    </svg>
  )
  // service — megaphone
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11l19-9-9 19-2-8-8-2z"/>
    </svg>
  )
}

const GRID_ITEMS = [
  { type: 'tournaments', label: 'События',        path: '/tournaments' },
  { type: 'profile',     label: 'Клуб',           path: '/profile'     },
  { type: 'shop',        label: 'Инвентарь',      path: '/shop'        },
  { type: 'service',     label: 'Клубный Сервис', path: '/service'     },
]

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
    <div className="min-h-screen pb-24 px-4 pt-5 space-y-4 relative z-10">

      {/* ── Header ── */}
      <motion.div
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-glow-gold">
            ROYAL <span className="text-poker-gold">ROLL</span>
          </h1>
          <p className="text-[11px] text-gray-600 mt-0.5">
            Добро пожаловать, {tgUser?.first_name || 'игрок'}
          </p>
        </div>
        {/* Gold Ace of Spades */}
        <motion.div
          animate={{ rotateY: [0, 15, -15, 0] }}
          transition={{ repeat: Infinity, duration: 5, ease: 'easeInOut' }}
          className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
          style={{
            background: 'linear-gradient(135deg, #1e1a0e, #2a2210)',
            border: '1px solid rgba(212,168,67,0.3)',
            boxShadow: '0 0 16px rgba(212,168,67,0.15)',
          }}
        >
          🂡
        </motion.div>
      </motion.div>

      {/* ── Double Wallet ── */}
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.05 }}
        className="grid grid-cols-2 gap-3"
      >
        {/* Клубные Активы (RR) */}
        <div className="card-surface-glow p-4 relative overflow-hidden">
          <div className="flex items-center gap-2 mb-2">
            {/* Gold bag icon */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M9 4h6l1 3H8L9 4z" fill="#d4a843" opacity="0.9"/>
              <rect x="4" y="7" width="16" height="13" rx="3" fill="#d4a843" opacity="0.15" stroke="#d4a843" strokeWidth="1.5"/>
              <path d="M12 11v4M10 13h4" stroke="#d4a843" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Клубные Активы</span>
          </div>
          <div className="text-2xl font-extrabold text-poker-gold tabular-nums">
            {(user?.balance ?? 0).toLocaleString()}
          </div>
          <div className="text-[10px] text-poker-gold/40 mt-0.5 font-medium">RR</div>
        </div>

        {/* Бонусные Баллы (BR) */}
        <div className="card-surface p-4 relative overflow-hidden" style={{ borderColor: 'rgba(99,102,241,0.15)' }}>
          <div className="flex items-center gap-2 mb-2">
            {/* Blue gift icon */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="8" width="18" height="13" rx="2" fill="#6366f1" opacity="0.15" stroke="#6366f1" strokeWidth="1.5"/>
              <path d="M12 8V21M3 13h18" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M8 8c0-2 1.5-4 4-4s4 2 4 4" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Бонусные Баллы</span>
          </div>
          <div className="text-2xl font-extrabold text-indigo-400 tabular-nums">
            {(user?.fun_balance ?? 0).toLocaleString()}
          </div>
          <div className="text-[10px] text-indigo-400/40 mt-0.5 font-medium">BR</div>
        </div>
      </motion.div>

      {/* ── Battle Pass strip ── */}
      {season && (
        <motion.div
          initial={{ y: 6, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="card-ticket p-3.5"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-base">🏆</span>
              <div>
                <div className="text-xs font-bold text-poker-gold">{season.season_name}</div>
                <div className="text-[10px] text-gray-600">Осталось {daysLeft} дн.</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs font-extrabold text-poker-gold">Ур. {season.current_level}</div>
              <div className="text-[10px] text-gray-600">/ {season.total_levels}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${season.progress_pct}%` }}
                transition={{ duration: 0.9, ease: 'easeOut' }}
                className="h-full rounded-full"
                style={{ background: 'linear-gradient(90deg, #c49a30, #f0d078)' }}
              />
            </div>
            <span className="text-[10px] text-gray-600 font-mono w-16 text-right">
              {season.current_xp}/{season.xp_per_level} XP
            </span>
          </div>
        </motion.div>
      )}

      {/* ── ВХОД В ЗАЛ button ── */}
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.12, type: 'spring', stiffness: 180 }}
        className="relative"
      >
        {/* Ambient glow */}
        <motion.div
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
          className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at center, rgba(212,168,67,0.25) 0%, transparent 70%)', filter: 'blur(12px)' }}
        />
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => navigate('/tables')}
          className="relative w-full py-5 rounded-2xl font-extrabold text-lg tracking-[0.12em] overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #b8892a 0%, #f0d078 35%, #d4a843 65%, #9a7020 100%)',
            boxShadow: '0 0 32px rgba(212,168,67,0.35), 0 6px 24px rgba(0,0,0,0.6)',
            color: '#0a0a0a',
          }}
        >
          {/* Shimmer */}
          <motion.div
            animate={{ x: ['-120%', '220%'] }}
            transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut', repeatDelay: 1.5 }}
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.35) 50%, transparent 70%)',
              transform: 'skewX(-15deg)',
            }}
          />
          <span className="relative z-10 flex items-center justify-center gap-3">
            <span className="text-xl">♠</span>
            <span>ВХОД В ЗАЛ</span>
            <span className="text-xl">♠</span>
          </span>
        </motion.button>
      </motion.div>

      {/* ── 4-icon grid ── */}
      <motion.div
        initial={{ y: 8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.18 }}
        className="grid grid-cols-4 gap-2"
      >
        {GRID_ITEMS.map((item, i) => (
          <motion.button
            key={item.path}
            whileTap={{ scale: 0.93 }}
            onClick={() => navigate(item.path)}
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 + i * 0.04 }}
            className="card-surface p-3 flex flex-col items-center gap-1.5 hover:border-poker-gold/20 transition-colors"
          >
            <GridIcon type={item.type} />
            <span className="text-[9px] text-gray-500 font-medium leading-tight text-center">{item.label}</span>
          </motion.button>
        ))}
      </motion.div>

      {/* ── TON Wallet ── */}
      <motion.div
        initial={{ y: 8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.25 }}
        className="card-surface p-4"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {/* TON logo */}
            <svg width="18" height="18" viewBox="0 0 56 56" fill="none">
              <circle cx="28" cy="28" r="28" fill="#0098EA"/>
              <path d="M37.5 15H18.5C15.4 15 13.5 18.4 15.1 21L26.4 41.5C27.1 42.8 28.9 42.8 29.6 41.5L40.9 21C42.5 18.4 40.6 15 37.5 15Z" fill="white"/>
              <path d="M28 15L21 30H35L28 15Z" fill="#0098EA" opacity="0.3"/>
            </svg>
            <span className="text-sm font-bold">TON Кошелёк</span>
          </div>
          {address && (
            <span className="text-[10px] text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Подключён
            </span>
          )}
        </div>
        {address ? (
          <div className="space-y-2">
            <div className="rounded-xl p-2.5 font-mono text-xs text-gray-500 truncate" style={{ background: 'rgba(255,255,255,0.03)' }}>
              {address}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => navigate('/shop')} className="btn-gold !py-2 !text-xs !rounded-xl">
                Пополнить
              </button>
              <button
                onClick={() => tonConnectUI.disconnect()}
                className="btn-secondary !py-2 !text-xs !rounded-xl"
              >
                Отключить
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => tonConnectUI.openModal()}
            className="w-full rounded-xl py-3 text-sm text-gray-400 font-medium transition-all hover:text-white"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            Подключить кошелёк
          </button>
        )}
      </motion.div>

      {/* ── Footer ── */}
      <p className="text-center text-[10px] text-gray-700 pb-2">
        Используя приложение, вы соглашаетесь с{' '}
        <button onClick={() => navigate('/terms')} className="text-gray-600 underline underline-offset-2">
          Условиями использования
        </button>
        . Все активы виртуальны.
      </p>
    </div>
  )
}
