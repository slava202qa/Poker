import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useTelegram } from '../hooks/useTelegram'
import { useWebSocket } from '../hooks/useWebSocket'
import { useStore } from '../store/useStore'
import { PlayingCard } from '../components/PlayingCard'
import { PlayerSeat } from '../components/PlayerSeat'
import { ActionPanel } from '../components/ActionPanel'

// Seat positions around an oval table (percentages)
const SEAT_POSITIONS: Record<number, { x: string; y: string }> = {
  0: { x: '50%', y: '88%' },   // bottom center (hero)
  1: { x: '15%', y: '75%' },   // bottom left
  2: { x: '5%', y: '45%' },    // mid left
  3: { x: '15%', y: '15%' },   // top left
  4: { x: '40%', y: '5%' },    // top center-left
  5: { x: '60%', y: '5%' },    // top center-right
  6: { x: '85%', y: '15%' },   // top right
  7: { x: '95%', y: '45%' },   // mid right
  8: { x: '85%', y: '75%' },   // bottom right
}

export default function TableRoom() {
  const { tableId } = useParams<{ tableId: string }>()
  const navigate = useNavigate()
  const { user: tgUser } = useTelegram()
  const gameState = useStore((s) => s.gameState)
  const userId = tgUser?.id ?? 0

  const { send } = useWebSocket(
    tableId ? Number(tableId) : null,
    userId || null,
  )

  const [timer, setTimer] = useState(30)

  // Timer countdown
  useEffect(() => {
    if (!gameState?.hand_in_progress || gameState.current_player !== userId) {
      return
    }
    setTimer(30)
    const interval = setInterval(() => {
      setTimer((t) => {
        if (t <= 0) {
          clearInterval(interval)
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [gameState?.current_player, userId])

  const handleAction = (action: string, amount?: number) => {
    send({ type: 'action', action, amount: amount ?? 0 })
  }

  const handleBack = () => {
    navigate('/tables')
  }

  const players = gameState?.players ?? []
  const communityCards = gameState?.community_cards ?? []
  const pot = gameState?.pot ?? 0
  const currentPlayer = gameState?.current_player
  const isMyTurn = currentPlayer === userId
  const myPlayer = players.find((p: any) => p.user_id === userId)

  // Demo state for when not connected
  const showDemo = !gameState

  return (
    <div className="min-h-screen flex flex-col bg-poker-darker">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-poker-dark/80 backdrop-blur-sm border-b border-poker-border z-10">
        <button onClick={handleBack} className="text-gray-400 text-sm">
          ← Назад
        </button>
        <span className="text-sm font-medium">
          Стол #{tableId}
        </span>
        <span className="text-xs text-gray-500">
          {gameState?.street?.toUpperCase() || 'WAITING'}
        </span>
      </div>

      {/* Table area */}
      <div className="flex-1 relative overflow-hidden">
        {/* Felt table */}
        <div className="absolute inset-4 sm:inset-8">
          <div className="w-full h-full relative">
            {/* Table shape */}
            <div className="absolute inset-0 bg-felt rounded-[50%] border-4 border-amber-900/60 shadow-2xl" />
            <div className="absolute inset-2 rounded-[50%] border border-green-600/30" />

            {/* Pot display */}
            <AnimatePresence>
              {pot > 0 && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10"
                >
                  <div className="bg-black/60 backdrop-blur-sm px-4 py-2 rounded-full border border-poker-gold/30">
                    <span className="text-poker-gold font-bold text-sm">
                      Банк: {pot.toFixed(0)} CHIP
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Community cards */}
            <div className="absolute top-[38%] left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
              {communityCards.map((card: any, i: number) => (
                <motion.div
                  key={i}
                  initial={{ y: -30, opacity: 0, rotateY: 180 }}
                  animate={{ y: 0, opacity: 1, rotateY: 0 }}
                  transition={{ delay: i * 0.15 }}
                >
                  <PlayingCard rank={card.rank} suit={card.suit} small />
                </motion.div>
              ))}
              {/* Placeholder slots */}
              {Array.from({ length: Math.max(0, 5 - communityCards.length) }).map((_, i) => (
                <div
                  key={`empty-${i}`}
                  className="w-10 h-14 rounded-lg border border-dashed border-green-700/30"
                />
              ))}
            </div>

            {/* Player seats */}
            {players.map((player: any) => (
              <PlayerSeat
                key={player.seat}
                player={player}
                isCurrentTurn={player.user_id === currentPlayer}
                isMe={player.user_id === userId}
                position={SEAT_POSITIONS[player.seat] || SEAT_POSITIONS[0]}
              />
            ))}

            {/* Demo seats when no game state */}
            {showDemo && (
              <>
                {[0, 2, 4, 6, 8].map((seat) => (
                  <div
                    key={seat}
                    className="absolute"
                    style={{
                      left: SEAT_POSITIONS[seat].x,
                      top: SEAT_POSITIONS[seat].y,
                      transform: 'translate(-50%, -50%)',
                    }}
                  >
                    <div className="w-16 h-16 rounded-full border-2 border-dashed border-poker-border/50 flex items-center justify-center">
                      <span className="text-gray-600 text-xs">Seat {seat + 1}</span>
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* Turn timer */}
            {isMyTurn && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute bottom-[15%] left-1/2 -translate-x-1/2 z-20"
              >
                <div className={`
                  w-12 h-12 rounded-full border-4 flex items-center justify-center font-bold text-lg
                  ${timer <= 5 ? 'border-red-500 text-red-400' : timer <= 15 ? 'border-yellow-500 text-yellow-400' : 'border-poker-gold text-poker-gold'}
                `}>
                  {timer}
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* Action panel */}
      <div className="bg-poker-dark/95 backdrop-blur-md border-t border-poker-border p-3 pb-6">
        {gameState?.hand_in_progress && myPlayer ? (
          <ActionPanel
            currentBet={gameState.current_bet}
            playerBet={myPlayer.current_bet}
            playerStack={myPlayer.stack}
            bigBlind={10} // TODO: get from table config
            onAction={handleAction}
            isMyTurn={isMyTurn}
          />
        ) : (
          <div className="text-center py-4">
            <button
              onClick={() => send({ type: 'start_hand' })}
              className="btn-gold px-8 py-3"
            >
              Начать раздачу
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
