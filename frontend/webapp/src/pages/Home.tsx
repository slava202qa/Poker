import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useTonConnectUI, useTonAddress } from '@tonconnect/ui-react'
import { useTelegram } from '../hooks/useTelegram'
import { useStore } from '../store/useStore'
import { ChipBalance } from '../components/ChipBalance'

export default function Home() {
  const navigate = useNavigate()
  const { user: tgUser } = useTelegram()
  const [tonConnectUI] = useTonConnectUI()
  const address = useTonAddress()
  const user = useStore((s) => s.user)

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.08 } },
  }
  const item = {
    hidden: { y: 16, opacity: 0 },
    show: { y: 0, opacity: 1 },
  }

  return (
    <div className="min-h-screen pb-24 px-4 pt-6">
      {/* Hero */}
      <motion.div
        initial={{ y: -16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="text-center mb-6 relative"
      >
        {/* Decorative glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-poker-gold/[0.04] rounded-full blur-3xl pointer-events-none" />

        <div className="relative">
          <div className="text-5xl mb-3">♠️</div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            Royal <span className="text-poker-gold text-glow-gold">Roll</span>
          </h1>
          <p className="text-gray-500 text-sm mt-1.5 font-medium">Texas Hold'em Poker</p>
        </div>
      </motion.div>

      {/* Balance card */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="card-surface-glow p-5 mb-5"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-gray-500 text-[11px] font-medium uppercase tracking-wider">Привет,</p>
            <p className="font-extrabold text-lg mt-0.5">{tgUser?.first_name || 'Player'}</p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <ChipBalance amount={user?.balance ?? 0} size="md" currency="chip" />
            <ChipBalance amount={user?.fun_balance ?? 0} size="sm" currency="fun" />
          </div>
        </div>

        <div className="flex gap-2.5">
          <button
            onClick={() => address ? tonConnectUI.disconnect() : tonConnectUI.openModal()}
            className="flex-1 btn-secondary !text-xs !py-2.5"
          >
            {address ? (
              <span className="flex items-center justify-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {address.slice(0, 6)}...{address.slice(-4)}
              </span>
            ) : '🔗 Кошелёк'}
          </button>
          <button
            onClick={() => navigate('/shop')}
            className="flex-1 btn-gold !text-xs !py-2.5"
          >
            💰 Донат
          </button>
        </div>
      </motion.div>

      {/* Quick play */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="mb-5"
      >
        <motion.button
          variants={item}
          onClick={() => navigate('/tables')}
          className="w-full card-surface p-5 mb-3 flex items-center gap-4 hover:border-poker-gold/20 transition-all active:scale-[0.98]"
        >
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-poker-gold/20 to-poker-gold/5 flex items-center justify-center text-2xl flex-shrink-0">
            🃏
          </div>
          <div className="text-left flex-1">
            <h3 className="font-bold">Быстрая игра</h3>
            <p className="text-xs text-gray-500 mt-0.5">Кэш-столы Texas Hold'em</p>
          </div>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </motion.button>
      </motion.div>

      {/* Grid actions */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-3 gap-2.5 mb-5"
      >
        {[
          { icon: '🏆', label: 'Турниры', path: '/tournaments', color: 'from-amber-500/10 to-amber-900/5' },
          { icon: '🛍', label: 'Сумка', path: '/shop', color: 'from-purple-500/10 to-purple-900/5' },
          { icon: '🎲', label: 'FUN', path: '/tables', color: 'from-emerald-500/10 to-emerald-900/5' },
        ].map((a) => (
          <motion.button
            key={a.label}
            variants={item}
            onClick={() => navigate(a.path)}
            className="card-surface p-4 flex flex-col items-center gap-2 hover:border-white/[0.1] transition-all active:scale-[0.97]"
          >
            <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${a.color} flex items-center justify-center text-xl`}>
              {a.icon}
            </div>
            <span className="text-[11px] font-semibold text-gray-300">{a.label}</span>
          </motion.button>
        ))}
      </motion.div>

      {/* Info banner */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="card-surface p-4"
      >
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-poker-gold/10 flex items-center justify-center text-poker-gold flex-shrink-0">
            ♦
          </div>
          <div>
            <p className="font-semibold text-sm">Royal Roll Poker</p>
            <p className="text-gray-500 text-xs mt-1 leading-relaxed">
              Играйте на RR или бесплатно на FUN.
              Покупка и продажа RR — через бота.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
