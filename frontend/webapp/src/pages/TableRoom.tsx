import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useTelegram } from '../hooks/useTelegram'
import { useWebSocket } from '../hooks/useWebSocket'
import { useSound } from '../hooks/useSound'
import { useStore } from '../store/useStore'
import { PlayingCard } from '../components/PlayingCard'
import { PlayerSeat } from '../components/PlayerSeat'
import { ActionPanel } from '../components/ActionPanel'
import { ChipAnimation, createBetChips, createWinChips, type FlyingChip } from '../components/ChipAnimation'
import { WinOverlay } from '../components/WinOverlay'
import { Confetti } from '../components/Confetti'

const SEAT_POSITIONS: Record<number, { x: string; y: string }> = {
  0: { x: '50%', y: '88%' },
  1: { x: '15%', y: '75%' },
  2: { x: '5%', y: '45%' },
  3: { x: '15%', y: '15%' },
  4: { x: '40%', y: '5%' },
  5: { x: '60%', y: '5%' },
  6: { x: '85%', y: '15%' },
  7: { x: '95%', y: '45%' },
  8: { x: '85%', y: '75%' },
}

export default function TableRoom() {
  const { tableId } = useParams<{ tableId: string }>()
  const navigate = useNavigate()
  const { tg, user: tgUser } = useTelegram()
  const gameState = useStore((s) => s.gameState)
  const userId = tgUser?.id ?? 0
  const sound = useSound()

  const { send } = useWebSocket(
    tableId ? Number(tableId) : null,
    userId || null,
  )

  const [timer, setTimer] = useState(30)
  const [flyingChips, setFlyingChips] = useState<FlyingChip[]>([])
  const [showWin, setShowWin] = useState(false)
  const [winInfo, setWinInfo] = useState({ name: '', amount: 0, handRank: '' })
  const [showConfetti, setShowConfetti] = useState(false)
  const prevStreetRef = useRef<string>('')
  const prevPotRef = useRef<number>(0)
  const prevHandRef = useRef<boolean>(false)

  // ── Sound + animation triggers based on state changes ──

  useEffect(() => {
    if (!gameState) return
    const street = gameState.street
    const prevStreet = prevStreetRef.current

    // New community cards dealt
    if (street !== prevStreet && prevStreet) {
      if (street === 'flop') {
        sound.cardDeal()
        setTimeout(() => sound.cardDeal(), 150)
        setTimeout(() => sound.cardDeal(), 300)
      } else if (street === 'turn' || street === 'river') {
        sound.cardFlip()
      } else if (street === 'showdown') {
        // Showdown — check for winners
        handleShowdown()
      }
    }

    // Hand just started — deal sound
    if (gameState.hand_in_progress && !prevHandRef.current) {
      sound.cardDeal()
      setTimeout(() => sound.cardDeal(), 200)
    }

    // Pot increased — chip sound
    if (gameState.pot > prevPotRef.current && prevPotRef.current > 0) {
      sound.chipClick()
    }

    prevStreetRef.current = street
    prevPotRef.current = gameState.pot
    prevHandRef.current = gameState.hand_in_progress
  }, [gameState?.street, gameState?.pot, gameState?.hand_in_progress])

  const handleShowdown = useCallback(() => {
    // Find winner from state (player with highest stack change)
    if (!gameState) return
    const players = gameState.players || []
    // Show win overlay for 3 seconds
    const winner = players.reduce((best: any, p: any) =>
      p.stack > (best?.stack || 0) ? p : best, null)

    if (winner) {
      const amount = gameState.pot * 0.97 // approximate after rake
      setWinInfo({
        name: winner.username || `Player ${winner.seat + 1}`,
        amount,
        handRank: '',
      })
      setShowWin(true)

      // Big win confetti (pot > 10x big blind, assume BB ~10)
      if (gameState.pot > 100) {
        setShowConfetti(true)
        sound.bigWin()
      } else {
        sound.win()
      }

      setTimeout(() => {
        setShowWin(false)
        setShowConfetti(false)
      }, 3500)
    }
  }, [gameState, sound])

  // ── Timer with sound + haptic ──

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
        if (t <= 5) {
          sound.timerWarning()
          // Telegram haptic feedback
          try { tg?.HapticFeedback?.impactOccurred?.('heavy') } catch {}
        } else if (t <= 10) {
          sound.timerTick()
        }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [gameState?.current_player, userId])

  const handleAction = (action: string, amount?: number) => {
    // Play action sound
    if (action === 'fold') sound.fold()
    else if (action === 'check') sound.check()
    else if (action === 'call' || action === 'bet' || action === 'raise') sound.chipClick()
    else if (action === 'all_in') sound.allIn()

    send({ type: 'action', action, amount: amount ?? 0 })
  }

  const players = gameState?.players ?? []
  const communityCards = gameState?.community_cards ?? []
  const pot = gameState?.pot ?? 0
  const currentPlayer = gameState?.current_player
  const isMyTurn = currentPlayer === userId
  const myPlayer = players.find((p: any) => p.user_id === userId)
  const showDemo = !gameState

  // Determine community card animation type based on count
  const getCommunityCardDelay = (index: number): number => {
    if (communityCards.length <= 3) {
      // Flop: stagger 3 cards
      return index * 0.2
    }
    if (index < 3) return 0 // Already shown
    return 0.1 // Turn/river: quick flip
  }

  return (
    <div className="min-h-screen flex flex-col bg-poker-darker">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-poker-dark/80 backdrop-blur-sm border-b border-poker-border z-10">
        <button onClick={() => navigate('/tables')} className="text-gray-400 text-sm">
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
        {/* Confetti layer */}
        <Confetti active={showConfetti} duration={3000} />

        {/* Win overlay */}
        <WinOverlay
          show={showWin}
          winnerName={winInfo.name}
          amount={winInfo.amount}
          handRank={winInfo.handRank}
        />

        {/* Chip animations */}
        <ChipAnimation chips={flyingChips} onComplete={() => setFlyingChips([])} />

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
                  <motion.div
                    animate={showWin ? {
                      scale: [1, 1.2, 0.8, 0],
                      opacity: [1, 1, 0.5, 0],
                    } : { scale: 1 }}
                    transition={{ duration: 0.6 }}
                    className="bg-black/60 backdrop-blur-sm px-4 py-2 rounded-full border border-poker-gold/30"
                  >
                    {/* Mini chip stack icon */}
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <div className="w-4 h-4 rounded-full bg-gradient-to-br from-poker-gold to-yellow-600 border border-white/30" />
                        <div className="w-4 h-4 rounded-full bg-gradient-to-br from-red-500 to-red-700 border border-white/30 absolute -top-1 -left-0.5" />
                      </div>
                      <span className="text-poker-gold font-bold text-sm">
                        {pot.toFixed(0)} CHIP
                      </span>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Community cards */}
            <div className="absolute top-[38%] left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
              <AnimatePresence>
                {communityCards.map((card: any, i: number) => {
                  const isFlop = i < 3 && communityCards.length >= 3
                  const isTurnRiver = i >= 3

                  return (
                    <motion.div
                      key={`cc-${i}-${card.rank}-${card.suit}`}
                      initial={
                        isFlop
                          ? { y: -50, opacity: 0, rotateY: 180, scale: 0.5 }
                          : isTurnRiver
                          ? { y: 0, opacity: 0, rotateY: 180, scale: 0.8 }
                          : { y: -30, opacity: 0, rotateY: 180 }
                      }
                      animate={{ y: 0, opacity: 1, rotateY: 0, scale: 1 }}
                      transition={
                        isFlop
                          ? {
                              delay: i * 0.2,
                              type: 'spring',
                              stiffness: 300,
                              damping: 15,
                            }
                          : isTurnRiver
                          ? {
                              duration: 0.6,
                              ease: [0.16, 1, 0.3, 1],
                            }
                          : { delay: i * 0.15 }
                      }
                    >
                      <PlayingCard
                        rank={card.rank}
                        suit={card.suit}
                        small
                        dealFrom="none"
                      />
                    </motion.div>
                  )
                })}
              </AnimatePresence>
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

            {/* Demo seats */}
            {showDemo && (
              <>
                {[0, 2, 4, 6, 8].map((seat) => (
                  <motion.div
                    key={seat}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: seat * 0.05 }}
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
                  </motion.div>
                ))}
              </>
            )}

            {/* Turn timer with pulse effect */}
            <AnimatePresence>
              {isMyTurn && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  className="absolute bottom-[15%] left-1/2 -translate-x-1/2 z-20"
                >
                  <motion.div
                    animate={timer <= 5 ? {
                      scale: [1, 1.15, 1],
                      boxShadow: [
                        '0 0 0px rgba(239,68,68,0)',
                        '0 0 30px rgba(239,68,68,0.6)',
                        '0 0 0px rgba(239,68,68,0)',
                      ],
                    } : {}}
                    transition={timer <= 5 ? { repeat: Infinity, duration: 0.8 } : {}}
                    className={`
                      w-14 h-14 rounded-full border-4 flex items-center justify-center font-bold text-xl
                      ${timer <= 5
                        ? 'border-red-500 text-red-400 bg-red-950/50'
                        : timer <= 15
                        ? 'border-yellow-500 text-yellow-400 bg-yellow-950/30'
                        : 'border-poker-gold text-poker-gold bg-poker-darker/50'
                      }
                    `}
                  >
                    {timer}
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
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
            bigBlind={10}
            onAction={handleAction}
            isMyTurn={isMyTurn}
          />
        ) : (
          <div className="text-center py-4">
            <motion.button
              whileTap={{ scale: 0.95 }}
              whileHover={{ scale: 1.02 }}
              onClick={() => send({ type: 'start_hand' })}
              className="btn-gold px-8 py-3"
            >
              Начать раздачу
            </motion.button>
          </div>
        )}
      </div>
    </div>
  )
}
