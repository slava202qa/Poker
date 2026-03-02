import { motion, AnimatePresence } from 'framer-motion'
import { PlayingCard } from './PlayingCard'

interface Props {
  player: {
    user_id: number
    seat: number
    stack: number
    status: string
    current_bet: number
    cards: { rank: number; suit: number }[]
    username?: string
  }
  isCurrentTurn: boolean
  isMe: boolean
  position: { x: string; y: string }
}

export function PlayerSeat({ player, isCurrentTurn, isMe, position }: Props) {
  const isFolded = player.status === 'folded'
  const isAllIn = player.status === 'all_in'

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: isFolded ? 0.4 : 1 }}
      transition={{ delay: player.seat * 0.1 }}
      className="absolute flex flex-col items-center"
      style={{ left: position.x, top: position.y, transform: 'translate(-50%, -50%)' }}
    >
      {/* Cards — deal animation with stagger */}
      <div className="flex gap-0.5 mb-1">
        <AnimatePresence>
          {isMe && player.cards.length > 0 ? (
            player.cards.map((c, i) => (
              <PlayingCard
                key={`${c.rank}-${c.suit}`}
                rank={c.rank}
                suit={c.suit}
                small
                dealDelay={player.seat * 0.15 + i * 0.1}
                dealFrom="deck"
              />
            ))
          ) : player.cards.length > 0 ? (
            <>
              <PlayingCard
                faceDown
                small
                dealDelay={player.seat * 0.15}
                dealFrom="deck"
              />
              <PlayingCard
                faceDown
                small
                dealDelay={player.seat * 0.15 + 0.1}
                dealFrom="deck"
              />
            </>
          ) : null}
        </AnimatePresence>
      </div>

      {/* Fold animation */}
      <AnimatePresence>
        {isFolded && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute -top-1 text-red-500/60 text-xs font-bold"
          >
            FOLD
          </motion.div>
        )}
      </AnimatePresence>

      {/* Player info */}
      <motion.div
        animate={{
          borderColor: isCurrentTurn ? 'rgba(212,168,67,1)' : 'rgba(30,42,58,1)',
          boxShadow: isCurrentTurn
            ? '0 0 20px rgba(212,168,67,0.4), 0 0 40px rgba(212,168,67,0.1)'
            : '0 0 0px rgba(0,0,0,0)',
        }}
        transition={{ duration: 0.3 }}
        className={`
          rounded-xl px-3 py-1.5 text-center min-w-[80px] border-2
          ${isCurrentTurn ? 'bg-poker-gold/20' : 'bg-poker-card'}
          ${isMe ? 'ring-1 ring-poker-gold/30' : ''}
        `}
      >
        <div className="text-xs font-medium truncate max-w-[80px]">
          {player.username || `Player ${player.seat + 1}`}
        </div>
        <div className="text-xs text-poker-gold font-bold">
          {player.stack.toFixed(0)} CHIP
        </div>
        {isAllIn && (
          <motion.span
            animate={{ opacity: [1, 0.5, 1] }}
            transition={{ repeat: Infinity, duration: 1 }}
            className="text-[10px] text-red-400 font-bold"
          >
            ALL IN
          </motion.span>
        )}
      </motion.div>

      {/* Current bet — animated chip stack */}
      <AnimatePresence>
        {player.current_bet > 0 && (
          <motion.div
            initial={{ y: -15, opacity: 0, scale: 0.5 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 10, opacity: 0, scale: 0.3 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="mt-1 flex items-center gap-1"
          >
            <div className="w-3 h-3 rounded-full bg-gradient-to-br from-poker-gold to-yellow-600 border border-white/30" />
            <span className="text-[10px] text-poker-gold-light font-bold">
              {player.current_bet.toFixed(0)}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
