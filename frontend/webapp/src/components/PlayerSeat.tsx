import { motion } from 'framer-motion'
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
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: player.seat * 0.1 }}
      className="absolute flex flex-col items-center"
      style={{ left: position.x, top: position.y, transform: 'translate(-50%, -50%)' }}
    >
      {/* Cards */}
      <div className="flex gap-0.5 mb-1">
        {isMe && player.cards.length > 0 ? (
          player.cards.map((c, i) => (
            <PlayingCard key={i} rank={c.rank} suit={c.suit} small />
          ))
        ) : player.cards.length > 0 ? (
          <>
            <PlayingCard faceDown small />
            <PlayingCard faceDown small />
          </>
        ) : null}
      </div>

      {/* Player info */}
      <div
        className={`
          rounded-xl px-3 py-1.5 text-center min-w-[80px]
          ${isCurrentTurn ? 'bg-poker-gold/20 border-2 border-poker-gold shadow-gold' : 'bg-poker-card border border-poker-border'}
          ${isFolded ? 'opacity-40' : ''}
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
          <span className="text-[10px] text-red-400 font-bold">ALL IN</span>
        )}
      </div>

      {/* Current bet */}
      {player.current_bet > 0 && (
        <motion.div
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="mt-1 text-[10px] bg-poker-darker/80 px-2 py-0.5 rounded-full text-poker-gold-light"
        >
          {player.current_bet.toFixed(0)}
        </motion.div>
      )}
    </motion.div>
  )
}
