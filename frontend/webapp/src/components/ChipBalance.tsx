import { motion } from 'framer-motion'

interface Props {
  amount: number
  currency?: 'chip' | 'fun'
  size?: 'sm' | 'md' | 'lg'
}

export function ChipBalance({ amount, currency = 'chip', size = 'md' }: Props) {
  const sizes = {
    sm: 'text-sm px-2 py-0.5',
    md: 'text-base px-3 py-1',
    lg: 'text-xl px-4 py-2',
  }

  const isChip = currency === 'chip'

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`inline-flex items-center gap-1 rounded-full font-bold ${sizes[size]} ${
        isChip
          ? 'bg-poker-gold/10 text-poker-gold border border-poker-gold/20'
          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
      }`}
    >
      <span className={isChip ? 'text-poker-gold-light' : 'text-emerald-300'}>
        {isChip ? '◆' : '●'}
      </span>
      <span>{amount.toLocaleString('en-US', { minimumFractionDigits: 0 })}</span>
      <span className={`text-xs ml-0.5 ${isChip ? 'text-poker-gold/70' : 'text-emerald-400/70'}`}>
        {isChip ? 'RR' : 'FUN'}
      </span>
    </motion.div>
  )
}
