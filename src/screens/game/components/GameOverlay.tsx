// src/screens/game/components/GameOverlay.tsx
import React from 'react'
import { useGameData } from '@/stores/gameData'

const GameOverlay = () => {
  const score = useGameData((state) => state.score)
  const topScore = useGameData((state) => state.topScore)

  return (
    <div className='fixed top-5 left-5 z-10 flex flex-col gap-2 text-sm md:text-base'>
      <div>Score: {score}</div>
      <div>Top Score: {topScore}</div>
    </div>
  )
}

export default GameOverlay
