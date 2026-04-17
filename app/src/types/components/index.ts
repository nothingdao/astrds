// src/types/components/index.ts

import { ReactNode } from 'react'
import { Overlay } from '../core'

// Base props interface for components that can be opened/closed
export interface ModalProps {
  isOpen?: boolean
  onClose: () => void
  children?: ReactNode
}

// Base props for overlay components
export interface OverlayProps extends ModalProps {
  overlayType: Overlay
  blur?: boolean
  shouldPauseGame?: boolean
}

// Common button props
export interface GameButtonProps {
  onClick: () => void
  disabled?: boolean
  loading?: boolean
  variant?: 'default' | 'primary' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  className?: string
  children: ReactNode
}

// Props for components that display scores
export interface ScoreDisplayProps {
  score: number
  label?: string
  className?: string
  animate?: boolean
}

// Props for components that handle wallet interactions
export interface WalletActionProps {
  onSuccess?: () => void
  onError?: (error: Error) => void
  loading?: boolean
  disabled?: boolean
  children?: ReactNode
}

// Game HUD component props
export interface HUDProps {
  score: number
  level: number
  lives: number
  isVisible?: boolean
  className?: string
}

// Animation component props
export interface AnimationProps {
  duration?: number
  delay?: number
  onComplete?: () => void
  className?: string
  children?: ReactNode
}

// Game control props
export interface GameControlProps {
  onPause: () => void
  onResume: () => void
  onRestart: () => void
  onQuit: () => void
  isPaused: boolean
  showControls?: boolean
}

// Menu component props
export interface MenuProps {
  items: {
    id: string
    label: string
    onClick: () => void
    disabled?: boolean
    icon?: ReactNode
  }[]
  orientation?: 'horizontal' | 'vertical'
  className?: string
}
