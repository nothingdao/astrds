import { create } from 'zustand'
import { convex } from '@/lib/convex'
import { api } from '../../convex/_generated/api'
import { Id } from '../../convex/_generated/dataModel'
import { Score } from '@/types/core'
import { GameStore, GameStoreState, GameError, GameStats } from '@/types/stores/game'

const initialState: GameStoreState = {
  isProcessing: false,
  score: 0,
  topScore: 0,
  lastGameStats: null,
  error: null,
  currentSessionId: null,
  walletAddress: null,
  sessionState: { status: null },
}

export const useGameData = create<GameStore>((set, get) => ({
  ...initialState,

  updateScore: (score: number) => {
    const validScore = Math.max(0, score)
    set((state) => ({
      score: validScore,
      topScore: Math.max(state.topScore, validScore),
      error: null,
    }))
  },

  addToScore: (points: number) => {
    const validPoints = Math.max(0, points)
    set((state) => ({ score: state.score + validPoints, error: null }))
  },

  submitFinalScore: async (walletAddress: string): Promise<Score[] | null> => {
    if (!walletAddress) return null
    const currentScore = get().score
    if (currentScore <= 0) return null

    set({ isProcessing: true, error: null })
    try {
      const updatedScores = await convex.mutation(api.scores.submitScore, {
        walletAddress,
        score: currentScore,
      })

      if (Array.isArray(updatedScores) && updatedScores.length > 0) {
        const playerRank =
          updatedScores.findIndex((s) => s.walletAddress === walletAddress) + 1

        const newStats: GameStats = {
          score: currentScore,
          rank: playerRank,
          isHighScore: playerRank === 1,
          totalPlayers: updatedScores.length,
        }

        set({ topScore: updatedScores[0]?.score ?? 0, lastGameStats: newStats, isProcessing: false, error: null })
        return updatedScores as Score[]
      }
      throw new Error('Invalid score data received')
    } catch (err) {
      const error: GameError = { code: 'SUBMIT_SCORE_ERROR', message: 'Failed to submit score', details: err }
      set({ isProcessing: false, error })
      return null
    }
  },

  resetGame: () => set((state) => ({
    isProcessing: false,
    score: 0,
    error: null,
    lastGameStats: null,
    sessionState: { status: state.sessionState.status },
    // preserve currentSessionId, walletAddress, topScore — set by startGameSession / submitFinalScore
  })),
  clearError: () => set((state) => ({ ...state, error: null })),

  startGameSession: async (walletAddress: string) => {
    try {
      const sessionId = await convex.mutation(api.gameSessions.create, { walletAddress })
      set({ currentSessionId: sessionId, walletAddress, sessionState: { status: 'active' } })
      return sessionId
    } catch (err) {
      set((state) => ({
        ...state,
        error: { code: 'SESSION_START_ERROR', message: 'Failed to start game session', details: err },
        sessionState: { status: null },
      }))
      throw err
    }
  },

  endGameSession: async () => {
    const { currentSessionId, sessionState, score } = get()
    if (!currentSessionId || sessionState.status === 'ending' || sessionState.status === 'ended') return

    try {
      set({ sessionState: { status: 'ending' } })
      await convex.mutation(api.gameSessions.update, {
        sessionId: currentSessionId as Id<'gameSessions'>,
        score,
        status: 'ended',
      })
      set({ currentSessionId: null, sessionState: { status: 'ended', endTime: new Date().toISOString() } })
    } catch (err) {
      set((state) => ({
        ...state,
        error: { code: 'SESSION_END_ERROR', message: err instanceof Error ? err.message : 'Failed to end game session', details: err },
        sessionState: { status: 'active' },
      }))
    }
  },
}))

export const selectScore = (state: GameStore) => state.score
export const selectTopScore = (state: GameStore) => state.topScore
export const selectLastGameStats = (state: GameStore) => state.lastGameStats
export const selectError = (state: GameStore) => state.error
