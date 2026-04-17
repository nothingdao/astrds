// src/types/components/overlays.ts
import { LucideIcon } from 'lucide-react'
import { Overlay } from '../core'

export interface OverlayProps {
  isVisible?: boolean
  onClose?: () => void
}

export interface PauseOverlayProps extends OverlayProps {
  shortcuts?: Array<{
    key: string
    action: string
  }>
}

export interface DeathDisplayProps extends OverlayProps {
  livesRemaining: number
  isInvulnerable: boolean
}

export interface HeaderButtonProps {
  icon: LucideIcon
  label: string
  overlayType: Overlay
  shortcut: string
  disabled?: boolean
}
