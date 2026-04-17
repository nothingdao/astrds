// src/types/components/leaderboard.ts
export interface LeaderboardScreenProps {
  isOverlay?: boolean
  onClose?: () => void
  onPlayAgain?: () => void
}

export interface LeaderboardTableProps {
  scores: Array<{
    walletAddress: string
    score: number
    date: string
  }>
  loading: boolean
  playerWallet?: string
}

export interface LeaderboardRankProps {
  rank: number
}
