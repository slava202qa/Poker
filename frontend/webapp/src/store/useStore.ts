import { create } from 'zustand'

interface User {
  id: number
  telegram_id: number
  username: string | null
  first_name: string
  ton_wallet: string | null
  balance: number
}

interface GameState {
  table_id: number | null
  street: string
  community_cards: any[]
  pot: number
  pots: any[]
  current_bet: number
  current_player: number | null
  players: any[]
  hand_in_progress: boolean
}

interface AppState {
  user: User | null
  setUser: (user: User | null) => void
  gameState: GameState | null
  setGameState: (state: GameState | null) => void
  isLoading: boolean
  setLoading: (loading: boolean) => void
}

export const useStore = create<AppState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  gameState: null,
  setGameState: (gameState) => set({ gameState }),
  isLoading: true,
  setLoading: (isLoading) => set({ isLoading }),
}))
