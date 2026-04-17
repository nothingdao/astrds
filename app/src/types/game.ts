// src/types/game.ts
export interface TokenEarned {
  symbol: string
  amount: number
  verified: boolean
}

export interface GameSession {
  id: string
  walletAddress: string
  score: number
  tokensEarned: TokenEarned[]
  levelReached: number
  sessionStart: string
  sessionEnd?: string
  lastUpdated: string
}
