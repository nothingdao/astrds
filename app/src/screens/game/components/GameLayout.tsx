// src/screens/game/components/GameLayout.tsx
import React from 'react'
import { GameHUD } from './GameHUD'
import LevelTransition from './LevelTransition'
import { useStateMachine } from '@/stores/stateMachine'
import { MachineState } from '@/types/machine'
import { GameLayoutProps, GameStateGuardProps } from '@/types/components/layout'

const GameStateGuard: React.FC<GameStateGuardProps> = ({
  children,
  allowedStates,
  fallback = null,
}) => {
  const currentState = useStateMachine((state) => state.currentState)

  if (!allowedStates.includes(currentState)) {
    return <>{fallback}</>
  }
  return <>{children}</>
}

const GameLayout: React.FC<GameLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-background text-foreground relative">
      <main className="flex items-center justify-center min-h-screen">
        {children}
        <LevelTransition />
      </main>

      <GameStateGuard allowedStates={[MachineState.PLAYING, MachineState.PAUSED]}>
        <GameHUD />
      </GameStateGuard>
    </div>
  )
}

export default GameLayout
