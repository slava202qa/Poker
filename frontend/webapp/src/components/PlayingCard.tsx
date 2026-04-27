import { motion } from 'framer-motion'
import { useStore } from '../store/useStore'

interface Props {
  rank?: number
  suit?: number
  faceDown?: boolean
  small?: boolean
  /** Delay before card appears (for staggered deal) */
  dealDelay?: number
  /** Animate card flying from deck position */
  dealFrom?: 'deck' | 'none'
}

const RANK_DISPLAY: Record<number, string> = {
  2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8',
  9: '9', 10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A',
}

const SUIT_DISPLAY: Record<number, { symbol: string; color: string }> = {
  0: { symbol: '♣', color: 'text-white' },
  1: { symbol: '♦', color: 'text-red-500' },
  2: { symbol: '♥', color: 'text-red-500' },
  3: { symbol: '♠', color: 'text-white' },
}

export function PlayingCard({
  rank, suit, faceDown = false, small = false,
  dealDelay = 0, dealFrom = 'deck',
}: Props) {
  const w = small ? 'w-10 h-14' : 'w-14 h-20'
  const equippedCardSkin = useStore((s) => s.equippedCardSkin)

  // Deal-from-deck animation: card flies in from center-top
  const dealInitial = dealFrom === 'deck'
    ? { x: 0, y: -80, scale: 0.3, opacity: 0, rotateY: 180, rotateZ: -20 }
    : { rotateY: 180, opacity: 0 }

  const dealAnimate = { x: 0, y: 0, scale: 1, opacity: 1, rotateY: 0, rotateZ: 0 }

  if (faceDown || rank === undefined || suit === undefined) {
    return (
      <motion.div
        initial={dealInitial}
        animate={{ ...dealAnimate, rotateY: 0 }}
        transition={{ duration: 0.5, delay: dealDelay, type: 'spring', stiffness: 200, damping: 20 }}
        className={`${w} rounded-lg border shadow-card overflow-hidden flex items-center justify-center`}
        style={{
          perspective: 800,
          ...(equippedCardSkin
            ? { borderColor: 'rgba(212,168,67,0.4)', background: '#111' }
            : { background: 'linear-gradient(135deg,#1e3a8a,#1e1b4b)', borderColor: 'rgba(96,165,250,0.5)' }),
        }}
      >
        {equippedCardSkin ? (
          <img src={equippedCardSkin} alt="card back" className="w-full h-full object-cover" />
        ) : (
          <div className="w-6 h-8 rounded border border-blue-400/30 bg-blue-700/50">
            <div className="w-full h-full flex items-center justify-center">
              <div className="w-3 h-3 rounded-full border border-blue-400/20" />
            </div>
          </div>
        )}
      </motion.div>
    )
  }

  const suitInfo = SUIT_DISPLAY[suit] ?? SUIT_DISPLAY[0]
  const rankStr = RANK_DISPLAY[rank] ?? '?'

  // Face-up card: flip from back to front
  return (
    <motion.div
      initial={dealFrom === 'deck'
        ? { ...dealInitial, rotateY: -180 }
        : { rotateY: -90, opacity: 0, scale: 0.8 }
      }
      animate={{ x: 0, y: 0, scale: 1, opacity: 1, rotateY: 0, rotateZ: 0 }}
      transition={{
        duration: 0.5,
        delay: dealDelay,
        type: 'spring',
        stiffness: 200,
        damping: 20,
      }}
      className={`${w} rounded-lg bg-white shadow-card flex flex-col items-center justify-center relative overflow-hidden`}
      style={{ perspective: 800, transformStyle: 'preserve-3d' }}
    >
      <span className={`${small ? 'text-xs' : 'text-sm'} font-bold ${suitInfo.color} absolute top-1 left-1.5`}>
        {rankStr}
      </span>
      <span className={`${small ? 'text-lg' : 'text-2xl'} ${suitInfo.color}`}>
        {suitInfo.symbol}
      </span>
      <span className={`${small ? 'text-xs' : 'text-sm'} font-bold ${suitInfo.color} absolute bottom-1 right-1.5 rotate-180`}>
        {rankStr}
      </span>
    </motion.div>
  )
}
