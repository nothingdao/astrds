import {
  createInitialSimulationState,
  drainSimulationEvents,
  resizeSimulation,
  simulationToSnapshot,
  updateSimulation,
  type SimulationState,
} from '../../../shared/game/simulation.js'
import type {
  GameSnapshot,
  InputState,
  ScreenBounds,
  SimulationEvent,
} from '../../../shared/game/protocol.js'

const DEFAULT_SCREEN: ScreenBounds = {
  width: 1280,
  height: 720,
}

export class GameSession {
  public readonly id: string
  private state: SimulationState

  constructor(id: string, screen: ScreenBounds = DEFAULT_SCREEN) {
    this.id = id
    this.state = createInitialSimulationState(id, screen)
  }

  update(dt: number, now = Date.now()): { snapshot: GameSnapshot; events: SimulationEvent[] } {
    updateSimulation(this.state, dt, now)
    return {
      snapshot: simulationToSnapshot(this.state),
      events: drainSimulationEvents(this.state),
    }
  }

  resize(screen: ScreenBounds): GameSnapshot {
    resizeSimulation(this.state, screen)
    return this.snapshot()
  }

  mergeInput(input: Partial<InputState>): void {
    this.state.input = { ...this.state.input, ...input }
  }

  reset(screen: ScreenBounds = this.state.screen): GameSnapshot {
    this.state = createInitialSimulationState(this.id, screen)
    return this.snapshot()
  }

  snapshot(): GameSnapshot {
    return simulationToSnapshot(this.state)
  }
}
