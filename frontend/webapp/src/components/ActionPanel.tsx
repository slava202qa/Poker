import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface Props {
  currentBet: number
  playerBet: number
  playerStack: number
  bigBlind: number
  onAction: (action: string, amount?: number) => void
  isMyTurn: boolean
}

export function ActionPanel({ currentBet, playerBet, playerStack, bigBlind, onAction, isMyTurn }: Props) {
  const [raiseAmount, setRaiseAmount] = useState(currentBet + bigBlind)
  const toCall = currentBet - playerBet
  const canCheck = toCall <= 0
  const minRaise = currentBet + bigBlind
  const maxRaise = playerBet + playerStack

  if (!isMyTurn) {
    return (
      <div className="h-20 flex items-center justify-center">
        <span className="text-gray-500 text-sm">Ожидание хода...</span>
      </div>
    )
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 50, opacity: 0 }}
        className="space-y-3"
      >
        {/* Raise slider */}
        {playerStack > toCall && (
          <div className="flex items-center gap-3 px-2">
            <span className="text-xs text-gray-400 w-12">{minRaise}</span>
            <input
              type="range"
              min={minRaise}
              max={maxRaise}
              step={bigBlind}
              value={raiseAmount}
              onChange={(e) => setRaiseAmount(Number(e.target.value))}
              className="flex-1 accent-poker-gold h-1"
            />
            <span className="text-xs text-poker-gold font-bold w-16 text-right">
              {raiseAmount}
            </span>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 px-2">
          <button
            onClick={() => onAction('fold')}
            className="flex-1 bg-red-900/50 border border-red-700/50 text-red-400 font-bold py-3 rounded-xl active:scale-95 transition-transform"
          >
            Fold
          </button>

          {canCheck ? (
            <button
              onClick={() => onAction('check')}
              className="flex-1 bg-poker-card border border-poker-border text-white font-bold py-3 rounded-xl active:scale-95 transition-transform"
            >
              Check
            </button>
          ) : (
            <button
              onClick={() => onAction('call')}
              className="flex-1 bg-blue-900/50 border border-blue-700/50 text-blue-400 font-bold py-3 rounded-xl active:scale-95 transition-transform"
            >
              Call {toCall}
            </button>
          )}

          {playerStack > toCall && (
            <button
              onClick={() => onAction('raise', raiseAmount)}
              className="flex-1 btn-gold py-3 rounded-xl"
            >
              Raise {raiseAmount}
            </button>
          )}
        </div>

        {/* Quick raise buttons */}
        {playerStack > toCall && (
          <div className="flex gap-2 px-2">
            {[0.5, 0.75, 1, 1.5].map((mult) => {
              const val = Math.min(Math.round(currentBet * mult + bigBlind), maxRaise)
              return (
                <button
                  key={mult}
                  onClick={() => setRaiseAmount(val)}
                  className="flex-1 text-xs py-1.5 bg-poker-darker border border-poker-border rounded-lg text-gray-400 hover:text-poker-gold transition-colors"
                >
                  {mult === 1 ? 'Pot' : `${mult * 100}%`}
                </button>
              )
            })}
            <button
              onClick={() => onAction('all_in', playerStack)}
              className="flex-1 text-xs py-1.5 bg-red-900/30 border border-red-700/30 rounded-lg text-red-400 font-bold"
            >
              All In
            </button>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
