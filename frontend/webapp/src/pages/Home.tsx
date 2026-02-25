import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useTonConnectUI } from '@tonconnect/ui-react'
import { useTelegram } from '../hooks/useTelegram'
import { useStore } from '../store/useStore'
import { ChipBalance } from '../components/ChipBalance'

export default function Home() {
  const navigate = useNavigate()
  const { user: tgUser } = useTelegram()
  const [tonConnectUI] = useTonConnectUI()
  const user = useStore((s) => s.user)

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  }

  const item = {
    hidden: { y: 20, opacity: 0 },
    show: { y: 0, opacity: 1 },
  }

  return (
    <div className="min-h-screen pb-20 px-4 pt-6">
      {/* Header */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="text-center mb-8"
      >
        <h1 className="text-3xl font-extrabold">
          <span className="text-poker-gold">♠</span> Poker
          <span className="text-poker-gold"> Platform</span>
        </h1>
        <p className="text-gray-500 text-sm mt-1">Texas Hold'em on TON</p>
      </motion.div>

      {/* Balance card */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="card-surface p-5 mb-6"
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-gray-400 text-xs">Привет,</p>
            <p className="font-bold text-lg">{tgUser?.first_name || 'Player'}</p>
          </div>
          <ChipBalance amount={user?.balance ?? 0} size="lg" />
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => tonConnectUI.openModal()}
            className="flex-1 btn-secondary text-sm py-2"
          >
            {user?.ton_wallet ? '✓ Кошелёк' : 'Подключить кошелёк'}
          </button>
          <button
            onClick={() => navigate('/shop')}
            className="flex-1 btn-gold text-sm py-2"
          >
            Пополнить
          </button>
        </div>
      </motion.div>

      {/* Quick actions */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 gap-3 mb-6"
      >
        <motion.button
          variants={item}
          onClick={() => navigate('/tables')}
          className="card-surface p-4 text-left hover:border-poker-gold/30 transition-colors"
        >
          <span className="text-2xl mb-2 block">🃏</span>
          <span className="font-bold text-sm">Кэш-столы</span>
          <p className="text-gray-500 text-xs mt-1">Texas Hold'em</p>
        </motion.button>

        <motion.button
          variants={item}
          onClick={() => navigate('/tournaments')}
          className="card-surface p-4 text-left hover:border-poker-gold/30 transition-colors"
        >
          <span className="text-2xl mb-2 block">🏆</span>
          <span className="font-bold text-sm">Турниры</span>
          <p className="text-gray-500 text-xs mt-1">Призовые фонды</p>
        </motion.button>

        <motion.button
          variants={item}
          onClick={() => navigate('/shop')}
          className="card-surface p-4 text-left hover:border-poker-gold/30 transition-colors"
        >
          <span className="text-2xl mb-2 block">💎</span>
          <span className="font-bold text-sm">Магазин</span>
          <p className="text-gray-500 text-xs mt-1">Купить CHIP</p>
        </motion.button>

        <motion.button
          variants={item}
          onClick={() => navigate('/profile')}
          className="card-surface p-4 text-left hover:border-poker-gold/30 transition-colors"
        >
          <span className="text-2xl mb-2 block">👤</span>
          <span className="font-bold text-sm">Профиль</span>
          <p className="text-gray-500 text-xs mt-1">Статистика</p>
        </motion.button>
      </motion.div>

      {/* Info banner */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="card-surface p-4 border-poker-gold/20"
      >
        <div className="flex items-start gap-3">
          <span className="text-poker-gold text-xl">♦</span>
          <div>
            <p className="font-semibold text-sm">Web3 Poker</p>
            <p className="text-gray-500 text-xs mt-1">
              Все ставки в CHIP токенах на блокчейне TON.
              Подключи кошелёк и начни играть.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
