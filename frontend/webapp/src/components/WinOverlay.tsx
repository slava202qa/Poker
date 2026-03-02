import { motion, AnimatePresence } from 'framer-motion'

interface Props {
  show: boolean
  winnerName: string
  amount: number
  handRank?: string
}

const HAND_NAMES: Record<string, string> = {
  HIGH_CARD: 'Старшая карта',
  ONE_PAIR: 'Пара',
  TWO_PAIR: 'Две пары',
  THREE_OF_A_KIND: 'Тройка',
  STRAIGHT: 'Стрит',
  FLUSH: 'Флеш',
  FULL_HOUSE: 'Фулл-хаус',
  FOUR_OF_A_KIND: 'Каре',
  STRAIGHT_FLUSH: 'Стрит-флеш',
  ROYAL_FLUSH: 'Роял-флеш',
}

export function WinOverlay({ show, winnerName, amount, handRank }: Props) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none"
        >
          {/* Gold radial glow */}
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1.5, opacity: 0.3 }}
            exit={{ scale: 2, opacity: 0 }}
            transition={{ duration: 0.8 }}
            className="absolute w-64 h-64 rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(212,168,67,0.6) 0%, rgba(212,168,67,0) 70%)',
            }}
          />

          {/* Particle ring */}
          {Array.from({ length: 12 }).map((_, i) => (
            <motion.div
              key={i}
              initial={{ scale: 0, opacity: 1 }}
              animate={{
                x: Math.cos((i * 30 * Math.PI) / 180) * 100,
                y: Math.sin((i * 30 * Math.PI) / 180) * 100,
                scale: 0,
                opacity: 0,
              }}
              transition={{ duration: 0.8, delay: 0.1 + i * 0.03 }}
              className="absolute w-2 h-2 rounded-full bg-poker-gold"
            />
          ))}

          {/* Win text */}
          <motion.div
            initial={{ scale: 0.5, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.8, y: -20, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.2 }}
            className="text-center"
          >
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ repeat: 2, duration: 0.4 }}
              className="bg-black/70 backdrop-blur-md rounded-2xl px-8 py-5 border border-poker-gold/50 shadow-gold"
            >
              <p className="text-poker-gold-light text-xs font-medium mb-1">ПОБЕДИТЕЛЬ</p>
              <p className="text-white font-bold text-lg mb-1">{winnerName}</p>
              {handRank && (
                <p className="text-poker-gold text-sm mb-2">
                  {HAND_NAMES[handRank] || handRank}
                </p>
              )}
              <motion.p
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.5, type: 'spring' }}
                className="text-poker-gold-light font-extrabold text-2xl"
              >
                +{amount.toFixed(0)} CHIP
              </motion.p>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
