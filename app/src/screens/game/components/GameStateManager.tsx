// src/screens/game/components/GameStateManager.tsx
import React, { useEffect } from 'react'
import { useStateMachine, selectMachineState } from '@/stores/stateMachine'
import TitleScreen from '@/screens/title/TitleScreen'
import ReadyScreen from '@/screens/ready/ReadyScreen'
import GameScreen from '@/screens/game/GameScreen'
import GameOverScreen from '@/screens/gameover/GameOverScreen'
import Header from '@/components/common/Header'
import { MachineState } from '@/types/machine'

const GameStateManager: React.FC = () => {
  const currentState = useStateMachine(selectMachineState)
  const resetState = useStateMachine(state => state.resetState)
  const isTransitioning = useStateMachine((state) => state.isTransitioning)

  const isGameplay = currentState === MachineState.PLAYING || currentState === MachineState.PAUSED

  useEffect(() => {
    if (currentState === MachineState.INITIAL) {
      resetState()
    }
  }, [currentState, resetState])

  // Optional loading state during transitions
  if (isTransitioning) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center">
        <div className="text-primary text-xl">Loading...</div>
      </div>
    )
  }

  const renderScreen = () => {
    switch (currentState) {
      case MachineState.INITIAL:
        return <TitleScreen />
      case MachineState.READY_TO_PLAY:
        return <ReadyScreen />
      case MachineState.PLAYING:
      case MachineState.PAUSED:
        return <GameScreen />
      case MachineState.GAME_OVER:
        return <GameOverScreen />
      default:
        return null
    }
  }

  return (
    <>
      {!isGameplay && <Header />}
      {renderScreen()}
    </>
  )
}

export default GameStateManager
