import {
  applySimulationConfig,
  createInitialSimulationState,
  drainSimulationEvents,
  injectAuthorizedSpaceToken,
  resizeSimulation,
  setEmissionTier,
  setSpaceTokenPools,
  simulationToSnapshot,
  updateSimulation,
  type SimulationConfig,
  type SimulationState,
} from '../../../shared/game/simulation.js'
import type {
  AuthorizedSpaceTokenSpawn,
  EmissionTier,
  GameSnapshot,
  InputState,
  ScreenBounds,
  SimulationEvent,
  SpaceTokenPool,
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

  setSpaceTokenPools(pools: SpaceTokenPool[]): void {
    setSpaceTokenPools(this.state, pools)
  }

  setEmissionTier(tier: EmissionTier): void {
    setEmissionTier(this.state, tier)
  }

  applyConfig(config: SimulationConfig): void {
    applySimulationConfig(this.state, config)
  }

  spawnAuthorizedSpaceToken(spawn: AuthorizedSpaceTokenSpawn, now = Date.now()): void {
    injectAuthorizedSpaceToken(this.state, spawn, now)
  }

  get level(): number {
    return this.state.level
  }

  reset(screen: ScreenBounds = this.state.screen): GameSnapshot {
    const nextState = createInitialSimulationState(this.id, screen)
    setEmissionTier(nextState, this.state.emissionTier)
    setSpaceTokenPools(nextState, this.state.spaceTokenPools)
    this.state = nextState
    return this.snapshot()
  }

  snapshot(): GameSnapshot {
    return simulationToSnapshot(this.state)
  }
}
