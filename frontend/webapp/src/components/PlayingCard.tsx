import { motion } from 'framer-motion'

interface Props {
  rank?: number
  suit?: number
  faceDown?: boolean
  small?: boolean
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

export function PlayingCard({ rank, suit, faceDown = false, small = false }: Props) {
  const w = small ? 'w-10 h-14' : 'w-14 h-20'

  if (faceDown || rank === undefined || suit === undefined) {
    return (
      <motion.div
        initial={{ rotateY: 180 }}
        animate={{ rotateY: 0 }}
        transition={{ duration: 0.4 }}
        className={`${w} rounded-lg bg-gradient-to-br from-blue-800 to-blue-950 border border-blue-600/50 shadow-card flex items-center justify-center`}
      >
        <div className="w-6 h-8 rounded border border-blue-400/30 bg-blue-700/50" />
      </motion.div>
    )
  }

  const suitInfo = SUIT_DISPLAY[suit] ?? SUIT_DISPLAY[0]
  const rankStr = RANK_DISPLAY[rank] ?? '?'

  return (
    <motion.div
      initial={{ rotateY: -90, opacity: 0 }}
      animate={{ rotateY: 0, opacity: 1 }}
      transition={{ duration: 0.4 }}
      className={`${w} rounded-lg bg-white shadow-card flex flex-col items-center justify-center relative overflow-hidden`}
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
