// src/types/managers/overlay.ts
import { Overlay } from '../core'

export interface OverlayManagerProps {
  children?: React.ReactNode
}

export interface OverlayState {
  activeOverlay: Overlay | null
  wasGamePaused: boolean
  isBlurred: boolean
}

export interface OverlayActions {
  openOverlay: (overlay: Overlay) => void
  closeOverlay: () => void
  isOverlayActive: (overlay: Overlay) => boolean
}

export interface OverlayStore extends OverlayState, OverlayActions {}

export interface OverlayBehavior {
  blur: boolean
  shouldPause: boolean
}

export interface OverlayConfig {
  [key: string]: OverlayBehavior
}
