// 2. Update src/types/stores/machine.ts (renamed from gameState.ts):
import { MachineState } from '../machine'

export interface StateMachineState {
  currentState: MachineState
  previousState: MachineState | null
  isTransitioning: boolean
  isPaused: boolean
  error: Error | null
  transitionHistory: Array<{
    from: MachineState
    to: MachineState
    timestamp: number
  }>
}

export interface StateMachineValidation {
  canTransition: (from: MachineState, to: MachineState) => boolean
  validateTransition: (from: MachineState, to: MachineState) => void
}

export interface StateMachineActions {
  setState: (newState: MachineState) => void
  setPause: (paused: boolean) => void
  resetState: () => void
  setError: (error: Error | null) => void
  startTransition: (from: MachineState, to: MachineState) => Promise<void>
  cancelTransition: () => void
}

export type StateMachineStore = StateMachineState &
  StateMachineActions &
  StateMachineValidation
