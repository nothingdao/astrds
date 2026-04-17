// src/types/machine.ts:
export enum MachineState {
  INITIAL = 'INITIAL',
  READY_TO_PLAY = 'READY_TO_PLAY',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER',
  PAUSED = 'PAUSED',
}

// Type guard (moved from core.ts)
export const isMachineState = (state: unknown): state is MachineState => {
  return Object.values(MachineState).includes(state as MachineState)
}

export function assertMachineState(
  state: unknown
): asserts state is MachineState {
  if (!isMachineState(state)) {
    throw new Error(`Invalid machine state: ${state}`)
  }
}

// Add valid transition map
export const VALID_TRANSITIONS: Record<MachineState, readonly MachineState[]> =
  {
    [MachineState.INITIAL]: [MachineState.READY_TO_PLAY],
    [MachineState.READY_TO_PLAY]: [MachineState.PLAYING, MachineState.INITIAL],
    [MachineState.PLAYING]: [MachineState.PAUSED, MachineState.GAME_OVER],
    [MachineState.PAUSED]: [MachineState.PLAYING, MachineState.INITIAL],
    [MachineState.GAME_OVER]: [
      MachineState.READY_TO_PLAY,
      MachineState.INITIAL,
    ],
  } as const
