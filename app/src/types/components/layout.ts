// src/types/components/layout.ts

import { ReactNode } from 'react'
import { MachineState } from '@/types/machine' // Update this import

export interface GameLayoutProps {
  children: ReactNode
}

export interface GameScreenProps {
  className?: string
}

export interface GameStateGuardProps {
  children: ReactNode
  allowedStates: MachineState[] // Change GameState to MachineState
  fallback?: ReactNode
}

export interface GameOverlayProps {
  isVisible?: boolean
  blur?: boolean
  children: ReactNode
}
