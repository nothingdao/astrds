import type { SimulationConfig } from '../../../shared/game/simulation.js'

export type GameConfig = SimulationConfig & {
  version: number
  applyToRunning: boolean
  quarterUsd: number
  tierBreakpointsUsd: number[]
  pillsPerTier: number[]
  astrdsPerPill: number[]
}

export const DEFAULT_GAME_CONFIG: GameConfig = {
  version: 0,
  applyToRunning: false,
  powerupSpawnDelayMs: 15_000,
  shipPickupSpawnDelayMs: 20_000,
  maxPowerupsOnScreen: 2,
  powerupDurationMs: 10_000,
  maxLives: 5,
  quarterUsd: 0.25,
  tierBreakpointsUsd: [0.0024, 0.01, 0.05, 0.1],
  pillsPerTier: [5, 10, 25, 50, 100],
  astrdsPerPill: [10, 5, 2, 1, 0.5],
}
