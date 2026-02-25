import { motion } from 'framer-motion'

interface Props {
  amount: number
  size?: 'sm' | 'md' | 'lg'
}

export function ChipBalance({ amount, size = 'md' }: Props) {
  const sizes = {
    sm: 'text-sm px-2 py-0.5',
    md: 'text-base px-3 py-1',
    lg: 'text-xl px-4 py-2',
  }

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`chip-badge ${sizes[size]}`}
    >
      <span className="text-poker-gold-light">◆</span>
      <span>{amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
      <span className="text-poker-gold/70 text-xs ml-0.5">CHIP</span>
    </motion.div>
  )
}
