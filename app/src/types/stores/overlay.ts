// src/types/stores/overlay.ts
import { Overlay } from '../core'

export interface OverlayState {
  activeOverlay: Overlay | null
  previousOverlay: Overlay | null
  wasGamePaused: boolean
}

export interface OverlayActions {
  openOverlay: (overlay: Overlay) => void
  closeOverlay: () => void
  isOverlayActive: (overlay: Overlay) => boolean
}

export type OverlayStore = OverlayState & OverlayActions
