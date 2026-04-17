// src/stores/overlayStore.ts
import { create } from 'zustand'
import { Overlay } from '@/types/core' // Keep Overlay in core
import { MachineState } from '@/types/machine'
import { OverlayStore } from '@/types/stores/overlay' // Move types to own file
import { useStateMachine } from './stateMachine'
import { useEngineStore } from './engineStore'

export const useOverlayStore = create<OverlayStore>((set, get) => ({
  activeOverlay: null,
  previousOverlay: null,
  wasGamePaused: false,

  openOverlay: (overlay: Overlay) => {
    const stateMachine = useStateMachine.getState()
    const wasPlaying = stateMachine.currentState === MachineState.PLAYING
    const currentOverlay = get().activeOverlay

    if (currentOverlay === overlay) {
      get().closeOverlay()
      return
    }

    if (wasPlaying && !stateMachine.isPaused) {
      useEngineStore.getState().stopGameLoop()
      stateMachine.setPause(true)
    }

    set({
      previousOverlay: currentOverlay,
      activeOverlay: overlay,
      wasGamePaused: wasPlaying,
    })
  },

  closeOverlay: () => {
    const { wasGamePaused } = get()
    const stateMachine = useStateMachine.getState()

    if (wasGamePaused && stateMachine.currentState === MachineState.PAUSED) {
      stateMachine.setPause(false)
      useEngineStore.getState().startGameLoop()
    }

    set({
      previousOverlay: get().activeOverlay,
      activeOverlay: null,
      wasGamePaused: false,
    })
  },

  isOverlayActive: (overlay: Overlay): boolean => {
    return get().activeOverlay === overlay
  },
}))
