import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export interface FlyingChip {
  id: string
  fromX: number
  fromY: number
  toX: number
  toY: number
  delay: number
  color: string
}

interface Props {
  chips: FlyingChip[]
  onComplete?: () => void
}

const RR_COLORS = [
  'from-poker-gold to-yellow-600',
  'from-red-500 to-red-700',
  'from-blue-500 to-blue-700',
  'from-green-500 to-green-700',
]

export function ChipAnimation({ chips, onComplete }: Props) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    if (chips.length === 0) return
    const maxDelay = Math.max(...chips.map(c => c.delay)) + 600
    const timer = setTimeout(() => {
      setVisible(false)
      onComplete?.()
    }, maxDelay)
    return () => clearTimeout(timer)
  }, [chips, onComplete])

  if (!visible || chips.length === 0) return null

  return (
    <div className="absolute inset-0 pointer-events-none z-30">
      <AnimatePresence>
        {chips.map((chip) => (
          <motion.div
            key={chip.id}
            initial={{
              x: chip.fromX,
              y: chip.fromY,
              scale: 1,
              opacity: 1,
            }}
            animate={{
              x: chip.toX,
              y: chip.toY,
              scale: 0.6,
              opacity: 0,
            }}
            transition={{
              duration: 0.5,
              delay: chip.delay / 1000,
              ease: 'easeInOut',
            }}
            className={`absolute w-6 h-6 rounded-full bg-gradient-to-br ${chip.color} border border-white/30 shadow-lg`}
            style={{ left: 0, top: 0 }}
          >
            <div className="w-full h-full rounded-full border border-dashed border-white/30" />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

/**
 * Generate chip animation data for a bet going to pot.
 */
export function createBetChips(
  fromX: number, fromY: number,
  toX: number, toY: number,
  count: number = 5,
): FlyingChip[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `bet-${Date.now()}-${i}`,
    fromX: fromX + (Math.random() - 0.5) * 20,
    fromY: fromY + (Math.random() - 0.5) * 20,
    toX: toX + (Math.random() - 0.5) * 30,
    toY: toY + (Math.random() - 0.5) * 15,
    delay: i * 60,
    color: RR_COLORS[i % RR_COLORS.length],
  }))
}

/**
 * Generate chip animation data for winnings going to player.
 */
export function createWinChips(
  fromX: number, fromY: number,
  toX: number, toY: number,
  count: number = 8,
): FlyingChip[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `win-${Date.now()}-${i}`,
    fromX: fromX + (Math.random() - 0.5) * 40,
    fromY: fromY + (Math.random() - 0.5) * 20,
    toX: toX + (Math.random() - 0.5) * 20,
    toY: toY + (Math.random() - 0.5) * 20,
    delay: i * 50,
    color: RR_COLORS[i % RR_COLORS.length],
  }))
}
