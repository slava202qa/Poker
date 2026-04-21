import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useTelegram } from '../hooks/useTelegram'
import { useWebSocket } from '../hooks/useWebSocket'
import { useSound } from '../hooks/useSound'
import { useStore } from '../store/useStore'
import { useApi } from '../hooks/useApi'
import { PlayingCard } from '../components/PlayingCard'
import { PlayerSeat } from '../components/PlayerSeat'
import { ActionPanel } from '../components/ActionPanel'
import { ChipAnimation, createBetChips, createWinChips, type FlyingChip } from '../components/ChipAnimation'
import { WinOverlay } from '../components/WinOverlay'
import { Confetti } from '../components/Confetti'

const SEAT_POSITIONS: Record<number, { x: string; y: string }> = {
  0: { x: '50%', y: '88%' },
  1: { x: '15%', y: '75%' },
  2: { x: '5%',  y: '45%' },
  3: { x: '15%', y: '15%' },
  4: { x: '40%', y: '5%'  },
  5: { x: '60%', y: '5%'  },
  6: { x: '85%', y: '15%' },
  7: { x: '95%', y: '45%' },
  8: { x: '85%', y: '75%' },
}

// Badge shown next to a player seat
function SeatBadge({ label, color }: { label: string; color: string }) {
  return (
    <div className={`absolute -top-3 left-1/2 -translate-x-1/2 text-[9px] font-black px-1.5 py-0.5 rounded-full border ${color} z-20 whitespace-nowrap`}>
      {label}
    </div>
  )
}

export default function TableRoom() {
  const { tableId } = useParams<{ tableId: string }>()
  const navigate = useNavigate()
  const { tg, user: tgUser } = useTelegram()
  const gameState = useStore((s) => s.gameState)
  const storeUser = useStore((s) => s.user)
  const userId = tgUser?.id ?? 0
  const sound = useSound()

  const { send } = useWebSocket(tableId ? Number(tableId) : null)
  const api = useApi()

  // Join modal state
  const [tableInfo, setTableInfo] = useState<any>(null)
  const [showJoin, setShowJoin] = useState(false)
  const [joinSeat, setJoinSeat] = useState(1)
  const [joinBuyIn, setJoinBuyIn] = useState(200)
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState('')
  const [hasJoined, setHasJoined] = useState(false)

  const [timer, setTimer] = useState(30)
  const [flyingChips, setFlyingChips] = useState<FlyingChip[]>([])
  const [showWin, setShowWin] = useState(false)
  const [winInfo, setWinInfo] = useState({ name: '', amount: 0, handRank: '' })
  const [showConfetti, setShowConfetti] = useState(false)
  const prevStreetRef = useRef<string>('')
  const prevPotRef = useRef<number>(0)
  const prevHandRef = useRef<boolean>(false)

  // Load table info and show join modal if not already seated
  useEffect(() => {
    if (!tableId) return
    api.get<any>(`/tables/${tableId}`).then(t => {
      setTableInfo(t)
      // Check if already in game state as a player
      const alreadySeated = gameState?.players?.some((p: any) => p.user_id === storeUser?.id)
      if (!alreadySeated && !hasJoined) {
        setJoinBuyIn(t.min_buy_in ?? 200)
        setShowJoin(true)
      }
    }).catch(() => {})
  }, [tableId])

  async function handleJoin() {
    if (joining || !tableId) return
    setJoining(true)
    setJoinError('')
    try {
      await api.post(`/tables/${tableId}/join`, {
        seat: joinSeat,
        buy_in: joinBuyIn,
      })
      setHasJoined(true)
      setShowJoin(false)
    } catch (e: any) {
      setJoinError(e.message || 'Ошибка при входе за стол')
    } finally {
      setJoining(false)
    }
  }

  async function handleLeave() {
    if (!tableId) return
    try {
      await api.post(`/tables/${tableId}/leave`, {})
    } catch {}
    navigate('/tables')
  }

  // ── Sound + animation triggers ──────────────────────────────────────────────
  useEffect(() => {
    if (!gameState) return
    const street = gameState.street
    const prevStreet = prevStreetRef.current

    if (street !== prevStreet && prevStreet) {
      if (street === 'flop') {
        sound.cardDeal()
        setTimeout(() => sound.cardDeal(), 150)
        setTimeout(() => sound.cardDeal(), 300)
      } else if (street === 'turn' || street === 'river') {
        sound.cardFlip()
      }
    }
    prevStreetRef.current = street

    const pot = gameState.pot ?? 0
    const prevPot = prevPotRef.current
    if (pot > prevPot && prevPot > 0) {
      // Animate from rough player area toward center pot
      const chips = createBetChips(50, 300, 180, 200, 5)
      setFlyingChips(chips)
    }
    prevPotRef.current = pot

    const handInProgress = gameState.hand_in_progress
    if (!handInProgress && prevHandRef.current) {
      const winners = gameState.players?.filter((p: any) => p.last_win > 0) ?? []
      if (winners.length > 0) {
        const winner = winners[0]
        const isMe = winner.user_id === userId
        setWinInfo({
          name: isMe ? 'Вы' : (winner.username || `Player ${winner.user_id}`),
          amount: winner.last_win,
          handRank: winner.hand_rank || '',
        })
        setShowWin(true)
        if (isMe) {
          setShowConfetti(true)
          sound.win()
          const winChips = createWinChips(180, 200, 50, 300, 8)
          setFlyingChips(winChips)
        }
        setTimeout(() => { setShowWin(false); setShowConfetti(false) }, 3500)
      }
    }
    prevHandRef.current = handInProgress
  }, [gameState])

  // ── Turn timer ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!gameState?.current_player) return
    if (gameState.current_player !== userId) { setTimer(30); return }
    setTimer(30)
    const interval = setInterval(() => {
      setTimer((t) => {
        if (t <= 1) { clearInterval(interval); return 0 }
        if (t <= 5) {
          sound.timerTick()
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

  // Dealer / SB / BB seat indices from game state
  const dealerSeat: number | null = gameState?.dealer_seat ?? null
  const sbSeat: number | null = gameState?.sb_seat ?? null
  const bbSeat: number | null = gameState?.bb_seat ?? null

  return (
    <div className="min-h-screen flex flex-col bg-poker-darker">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-poker-dark/80 backdrop-blur-sm border-b border-poker-border z-10">
        <button onClick={() => navigate('/tables')} className="text-gray-400 text-sm">
          ← Назад
        </button>
        <span className="text-sm font-medium">Стол #{tableId}</span>
        <span className="text-xs text-gray-500">
          {gameState?.street?.toUpperCase() || 'WAITING'}
        </span>
      </div>

      {/* Double wallet bar */}
      <div className="flex gap-2 px-4 py-2 bg-black/40 border-b border-poker-border/30">
        <div className="flex items-center gap-1.5 bg-poker-gold/10 border border-poker-gold/20 rounded-lg px-3 py-1.5 flex-1">
          <span className="text-poker-gold text-sm">💰</span>
          <div>
            <div className="text-[9px] text-gray-500 leading-none">Real RR</div>
            <div className="text-xs font-bold text-poker-gold leading-none">
              {(storeUser?.balance ?? 0).toLocaleString()}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-1.5 flex-1">
          <span className="text-blue-400 text-sm">🎁</span>
          <div>
            <div className="text-[9px] text-gray-500 leading-none">Bonus RR</div>
            <div className="text-xs font-bold text-blue-400 leading-none">
              {(storeUser?.fun_balance ?? 0).toLocaleString()}
            </div>
          </div>
        </div>
        {myPlayer && (
          <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 flex-1">
            <span className="text-gray-400 text-sm">🪙</span>
            <div>
              <div className="text-[9px] text-gray-500 leading-none">За столом</div>
              <div className="text-xs font-bold text-white leading-none">
                {Number(myPlayer.stack ?? 0).toLocaleString()}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Table area */}
      <div className="flex-1 relative overflow-hidden">
        <Confetti active={showConfetti} duration={3000} />
        <WinOverlay show={showWin} winnerName={winInfo.name} amount={winInfo.amount} handRank={winInfo.handRank} />
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
                    animate={showWin ? { scale: [1, 1.2, 0.8, 0], opacity: [1, 1, 0.5, 0] } : { scale: 1 }}
                    transition={{ duration: 0.6 }}
                    className="bg-black/60 backdrop-blur-sm px-4 py-2 rounded-full border border-poker-gold/30"
                  >
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <div className="w-4 h-4 rounded-full bg-gradient-to-br from-poker-gold to-yellow-600 border border-white/30" />
                        <div className="w-4 h-4 rounded-full bg-gradient-to-br from-red-500 to-red-700 border border-white/30 absolute -top-1 -left-0.5" />
                      </div>
                      <span className="text-poker-gold font-bold text-sm">{pot.toFixed(0)} RR</span>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Community cards */}
            <div className="absolute top-[38%] left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
              <AnimatePresence>
                {communityCards.map((card: any, i: number) => (
                  <motion.div
                    key={`cc-${i}-${card.rank}-${card.suit}`}
                    initial={{ y: -50, opacity: 0, rotateY: 180, scale: 0.5 }}
                    animate={{ y: 0, opacity: 1, rotateY: 0, scale: 1 }}
                    transition={{ delay: i < 3 ? i * 0.2 : 0.1, type: 'spring', stiffness: 300, damping: 15 }}
                  >
                    <PlayingCard rank={card.rank} suit={card.suit} small dealFrom="none" />
                  </motion.div>
                ))}
              </AnimatePresence>
              {Array.from({ length: Math.max(0, 5 - communityCards.length) }).map((_, i) => (
                <div key={`empty-${i}`} className="w-10 h-14 rounded-lg border border-dashed border-green-700/30" />
              ))}
            </div>

            {/* Player seats */}
            {players.map((player: any) => {
              const seat = player.seat
              const isDealer = dealerSeat === seat
              const isSB = sbSeat === seat
              const isBB = bbSeat === seat
              return (
                <div key={seat} className="absolute" style={{ left: SEAT_POSITIONS[seat]?.x, top: SEAT_POSITIONS[seat]?.y, transform: 'translate(-50%, -50%)' }}>
                  {/* Dealer / SB / BB badges */}
                  <div className="relative">
                    {isDealer && (
                      <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-white text-black text-[10px] font-black flex items-center justify-center border-2 border-poker-gold z-30 shadow-gold">
                        D
                      </div>
                    )}
                    {isSB && !isDealer && (
                      <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-blue-600 text-white text-[9px] font-black flex items-center justify-center border border-blue-400 z-30">
                        SB
                      </div>
                    )}
                    {isBB && !isDealer && (
                      <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-red-600 text-white text-[9px] font-black flex items-center justify-center border border-red-400 z-30">
                        BB
                      </div>
                    )}
                    <PlayerSeat
                      player={player}
                      isCurrentTurn={player.user_id === currentPlayer}
                      isMe={player.user_id === userId}
                      position={{ x: '0', y: '0' }}
                    />
                  </div>
                </div>
              )
            })}

            {/* Demo empty seats */}
            {showDemo && [0, 2, 4, 6, 8].map((seat) => (
              <motion.div
                key={seat}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: seat * 0.05 }}
                className="absolute"
                style={{ left: SEAT_POSITIONS[seat].x, top: SEAT_POSITIONS[seat].y, transform: 'translate(-50%, -50%)' }}
              >
                <div className="w-16 h-16 rounded-full border-2 border-dashed border-poker-border/50 flex items-center justify-center">
                  <span className="text-gray-600 text-xs">Место {seat + 1}</span>
                </div>
              </motion.div>
            ))}

            {/* Turn timer */}
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
                      boxShadow: ['0 0 0px rgba(239,68,68,0)', '0 0 30px rgba(239,68,68,0.6)', '0 0 0px rgba(239,68,68,0)'],
                    } : {}}
                    transition={timer <= 5 ? { repeat: Infinity, duration: 0.8 } : {}}
                    className={`w-14 h-14 rounded-full border-4 flex items-center justify-center font-bold text-xl ${
                      timer <= 5 ? 'border-red-500 text-red-400 bg-red-950/50'
                      : timer <= 15 ? 'border-yellow-500 text-yellow-400 bg-yellow-950/30'
                      : 'border-poker-gold text-poker-gold bg-poker-darker/50'
                    }`}
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
          <div className="text-center py-4 flex gap-3 justify-center flex-wrap">
            {myPlayer ? (
              <motion.button whileTap={{ scale: 0.95 }} onClick={() => send({ type: 'start_hand' })}
                className="btn-gold px-8 py-3">
                Начать раздачу
              </motion.button>
            ) : (
              <motion.button whileTap={{ scale: 0.95 }} onClick={() => setShowJoin(true)}
                className="btn-gold px-8 py-3">
                🪑 Сесть за стол
              </motion.button>
            )}
            <motion.button whileTap={{ scale: 0.95 }} onClick={handleLeave}
              className="px-6 py-3 rounded-xl text-sm text-gray-400"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
              Выйти
            </motion.button>
          </div>
        )}
      </div>

      {/* ── Join Modal ── */}
      <AnimatePresence>
        {showJoin && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex items-end justify-center"
            style={{ background: 'rgba(0,0,0,0.7)' }}>
            <motion.div initial={{ y: 80 }} animate={{ y: 0 }} exit={{ y: 80 }}
              className="w-full max-w-md rounded-t-3xl p-6"
              style={{ background: '#111', border: '1px solid rgba(212,168,67,0.2)' }}>

              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="font-extrabold text-lg">Сесть за стол</h2>
                  {tableInfo && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      {tableInfo.name} · {tableInfo.small_blind}/{tableInfo.big_blind} · {tableInfo.currency?.toUpperCase()}
                    </p>
                  )}
                </div>
                <button onClick={() => { setShowJoin(false); navigate('/tables') }}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-500"
                  style={{ background: 'rgba(255,255,255,0.06)' }}>✕</button>
              </div>

              {/* Seat selector */}
              <div className="mb-4">
                <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-2 block">Место</label>
                <div className="grid grid-cols-5 gap-2">
                  {[1,2,3,4,5,6,7,8,9].slice(0, tableInfo?.max_players ?? 6).map(s => {
                    const taken = gameState?.players?.some((p: any) => p.seat === s)
                    return (
                      <button key={s} disabled={taken} onClick={() => setJoinSeat(s)}
                        className="py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-30"
                        style={{
                          background: joinSeat === s ? 'rgba(212,168,67,0.2)' : 'rgba(255,255,255,0.04)',
                          border: `1px solid ${joinSeat === s ? 'rgba(212,168,67,0.5)' : 'rgba(255,255,255,0.08)'}`,
                          color: joinSeat === s ? '#d4a843' : '#9ca3af',
                        }}>
                        {taken ? '✗' : s}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Buy-in */}
              <div className="mb-5">
                <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-2 block">
                  Сумма входа {tableInfo && `(${tableInfo.min_buy_in}–${tableInfo.max_buy_in})`}
                </label>
                <input type="number" value={joinBuyIn}
                  min={tableInfo?.min_buy_in ?? 100}
                  max={tableInfo?.max_buy_in ?? 10000}
                  onChange={e => setJoinBuyIn(Number(e.target.value))}
                  className="w-full rounded-xl px-4 py-3 text-white text-lg font-bold outline-none"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(212,168,67,0.2)' }} />
                {/* Quick presets */}
                <div className="flex gap-2 mt-2">
                  {[tableInfo?.min_buy_in, tableInfo?.min_buy_in * 2, tableInfo?.max_buy_in].filter(Boolean).map((v: number) => (
                    <button key={v} onClick={() => setJoinBuyIn(v)}
                      className="flex-1 py-1.5 rounded-lg text-xs font-bold"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#9ca3af' }}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              {joinError && (
                <p className="text-red-400 text-xs mb-3 text-center">{joinError}</p>
              )}

              <button onClick={handleJoin} disabled={joining}
                className="w-full py-4 rounded-2xl font-extrabold text-base disabled:opacity-50"
                style={{ background: 'linear-gradient(90deg,#d4a843,#f0d078)', color: '#0a0a0a' }}>
                {joining ? 'Входим...' : `Сесть за стол · ${joinBuyIn} ${tableInfo?.currency?.toUpperCase() ?? 'RR'}`}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
