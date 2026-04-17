// src/types/components/game.ts

export interface LevelDisplayProps {
  className?: string
}

export interface LevelTransitionProps {
  duration?: number
  onComplete?: () => void
}
