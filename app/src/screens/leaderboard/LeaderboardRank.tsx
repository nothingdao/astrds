// src/screens/leaderboard/LeaderboardRank.tsx
import React from 'react'

const LeaderboardRank = ({ rank }) => {
  const getRankDisplay = () => {
    switch (rank) {
      case 1:
        return '🏆 New High Score!'
      case 2:
        return '🥈 Almost There!'
      case 3:
        return '🥉 Great Job!'
      default:
        return `Rank #${rank}`
    }
  }

  const getRankColor = () => {
    switch (rank) {
      case 1:
        return 'text-tx-warning'
      case 2:
        return 'text-tx-secondary'
      case 3:
        return 'text-amber-600'
      default:
        return 'text-tx-success'
    }
  }

  return (
    <div
      className={`mb-6 text-center ${getRankColor()} text-xl font-bold
                    animate-[fadeIn_0.5s_ease-out]`}
    >
      {getRankDisplay()}
      {rank <= 3 && (
        <div className='text-sm text-muted-foreground mt-1'>
          You made it to the podium!
        </div>
      )}
    </div>
  )
}

export default LeaderboardRank
