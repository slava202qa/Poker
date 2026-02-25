import { motion } from 'framer-motion'

interface Props {
  value: number
  size?: number
}

const CHIP_COLORS: Record<string, string> = {
  '1': 'from-gray-400 to-gray-600',
  '5': 'from-red-500 to-red-700',
  '10': 'from-blue-500 to-blue-700',
  '25': 'from-green-500 to-green-700',
  '100': 'from-poker-gold to-yellow-700',
  '500': 'from-purple-500 to-purple-700',
  '1000': 'from-orange-400 to-orange-600',
}

function getChipColor(value: number): string {
  if (value >= 1000) return CHIP_COLORS['1000']
  if (value >= 500) return CHIP_COLORS['500']
  if (value >= 100) return CHIP_COLORS['100']
  if (value >= 25) return CHIP_COLORS['25']
  if (value >= 10) return CHIP_COLORS['10']
  if (value >= 5) return CHIP_COLORS['5']
  return CHIP_COLORS['1']
}

export function PokerChip({ value, size = 40 }: Props) {
  const gradient = getChipColor(value)

  return (
    <motion.div
      initial={{ scale: 0, rotate: -180 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ type: 'spring', stiffness: 200 }}
      className={`bg-gradient-to-br ${gradient} rounded-full border-2 border-white/30 shadow-lg flex items-center justify-center`}
      style={{ width: size, height: size }}
    >
      <div
        className="rounded-full border border-dashed border-white/40 flex items-center justify-center"
        style={{ width: size * 0.7, height: size * 0.7 }}
      >
        <span className="text-white font-bold" style={{ fontSize: size * 0.25 }}>
          {value >= 1000 ? `${value / 1000}K` : value}
        </span>
      </div>
    </motion.div>
  )
}
