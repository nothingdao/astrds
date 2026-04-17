// src/stores/stateMachine.ts
import { create } from 'zustand'
import {
  MachineState,
  assertMachineState,
  VALID_TRANSITIONS,
} from '@/types/machine'
import { StateMachineStore, StateMachineState } from '@/types/stores/machine'

class InvalidTransitionError extends Error {
  constructor(from: MachineState, to: MachineState) {
    super(`Invalid state transition: ${from} -> ${to}`)
    this.name = 'InvalidTransitionError'
  }
}

const initialState: StateMachineState = {
  currentState: MachineState.INITIAL,
  previousState: null,
  isTransitioning: false,
  isPaused: false,
  error: null,
  transitionHistory: [],
}

export const useStateMachine = create<StateMachineStore>((set, get) => ({
  ...initialState,

  // Validation methods
  canTransition: (from: MachineState, to: MachineState): boolean => {
    return VALID_TRANSITIONS[from].includes(to)
  },

  validateTransition: (from: MachineState, to: MachineState): void => {
    if (!get().canTransition(from, to)) {
      throw new InvalidTransitionError(from, to)
    }
  },

  // State management
  setState: (newState: MachineState) => {
    assertMachineState(newState)
    const current = get()

    try {
      // Validate transition
      get().validateTransition(current.currentState, newState)

      set({
        previousState: current.currentState,
        currentState: newState,
        isTransitioning: true,
        transitionHistory: [
          ...current.transitionHistory,
          {
            from: current.currentState,
            to: newState,
            timestamp: Date.now(),
          },
        ],
      })

      // Clear transition flag after a short delay
      setTimeout(() => {
        if (get().currentState === newState) {
          set({ isTransitioning: false })
        }
      }, 100)
    } catch (error) {
      set({
        error:
          error instanceof Error
            ? error
            : new Error('Unknown transition error'),
      })
      throw error
    }
  },

  setPause: (paused: boolean) => {
    const current = get()

    // Don't do anything if pause state isn't changing
    if (current.isPaused === paused) return

    // Only allow pause/unpause during valid states
    if (paused && current.currentState === MachineState.PLAYING) {
      // Pause the game
      set({
        isPaused: true,
        currentState: MachineState.PAUSED,
        previousState: current.currentState,
        transitionHistory: [
          ...current.transitionHistory,
          {
            from: current.currentState,
            to: MachineState.PAUSED,
            timestamp: Date.now(),
          },
        ],
      })
    } else if (!paused && current.currentState === MachineState.PAUSED) {
      // Unpause - return to previous state (should be PLAYING)
      set({
        isPaused: false,
        currentState: MachineState.PLAYING,
        transitionHistory: [
          ...current.transitionHistory,
          {
            from: current.currentState,
            to: MachineState.PLAYING,
            timestamp: Date.now(),
          },
        ],
      })
    }
  },

  resetState: () => {
    set(initialState)
  },

  setError: (error: Error | null) => set({ error }),

  startTransition: async (from: MachineState, to: MachineState) => {
    const current = get()
    if (current.isTransitioning) {
      throw new Error('Transition already in progress')
    }

    try {
      get().validateTransition(from, to)
      set({ isTransitioning: true })

      // Add transition animation delay
      await new Promise((resolve) => setTimeout(resolve, 100))

      set({
        currentState: to,
        previousState: from,
        isTransitioning: false,
        transitionHistory: [
          ...current.transitionHistory,
          { from, to, timestamp: Date.now() },
        ],
      })
    } catch (error) {
      set({
        isTransitioning: false,
        error:
          error instanceof Error
            ? error
            : new Error('Unknown transition error'),
      })
      throw error
    }
  },

  cancelTransition: () => {
    const current = get()
    if (!current.isTransitioning) return

    set({
      currentState: current.previousState || MachineState.INITIAL,
      isTransitioning: false,
    })
  },
}))

// Selector helpers
export const selectMachineState = (state: StateMachineStore) =>
  state.currentState
export const selectIsPaused = (state: StateMachineStore) => state.isPaused
export const selectError = (state: StateMachineStore) => state.error
export const selectIsTransitioning = (state: StateMachineStore) =>
  state.isTransitioning
