// src/screens/leaderboard/LeaderboardScreen.tsx
import React, { useState, useEffect } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import LeaderboardTable from './LeaderboardTable'
import { LeaderboardScreenProps } from '@/types/components/leaderboard'
import { Score } from '@/types/core'

const LeaderboardScreen: React.FC<LeaderboardScreenProps> = ({
  isOverlay = false,
  onClose,
  onPlayAgain,
}) => {
  const wallet = useWallet()
  const highScoresRaw = useQuery(api.scores.getScores)
  const loading = highScoresRaw === undefined
  const highScores = highScoresRaw ?? []

  const [playerStats, setPlayerStats] = useState<{ topScore: number; rank: number | null }>({
    topScore: 0,
    rank: null,
  })

  useEffect(() => {
    if (!wallet.publicKey || highScores.length === 0) return
    const walletAddress = wallet.publicKey.toString()
    const playerScores = highScores.filter((s) => s.walletAddress === walletAddress)
    if (playerScores.length > 0) {
      const bestScore = Math.max(...playerScores.map((s) => s.score))
      const bestRank = highScores.findIndex(
        (s) => s.walletAddress === walletAddress && s.score === bestScore
      ) + 1
      setPlayerStats({ topScore: bestScore, rank: bestRank > 0 ? bestRank : null })
    }
  }, [wallet.publicKey, highScores])

  const formatRank = (rank: number | null) => {
    if (!rank) return null
    const lastDigit = rank % 10
    const lastTwoDigits = rank % 100
    let suffix = 'th'
    if (lastTwoDigits < 11 || lastTwoDigits > 13) {
      switch (lastDigit) {
        case 1: suffix = 'st'; break
        case 2: suffix = 'nd'; break
        case 3: suffix = 'rd'; break
      }
    }
    return `${rank}${suffix}`
  }

  return (
    <div className='flex flex-col h-full'>
      {/* Player stats strip */}
      <div className='flex items-center gap-6 px-5 py-2.5 border-b border-border shrink-0'>
        {wallet.connected ? (
          <>
            <div>
              <div className='font-mono text-[10px] uppercase tracking-widest text-tx-tertiary mb-0.5'>Top Score</div>
              <div className='font-mono text-xs text-foreground'>
                {playerStats.topScore ? playerStats.topScore.toLocaleString() : '—'}
              </div>
            </div>
            {playerStats.rank && (
              <div>
                <div className='font-mono text-[10px] uppercase tracking-widest text-tx-tertiary mb-0.5'>Best Rank</div>
                <div className='font-mono text-xs text-foreground'>{formatRank(playerStats.rank)}</div>
              </div>
            )}
            {!playerStats.rank && playerStats.topScore === 0 && (
              <span className='font-mono text-xs text-muted-foreground'>Play a game to appear on the leaderboard</span>
            )}
          </>
        ) : (
          <span className='font-mono text-xs text-muted-foreground'>Connect wallet to see your stats</span>
        )}
      </div>

      {/* Global leaderboard */}
      <div className='flex-1 overflow-y-auto min-h-0 px-5 py-3'>
        <LeaderboardTable scores={highScores as Score[]} loading={loading} />
      </div>
    </div>
  )
}

export default LeaderboardScreen
