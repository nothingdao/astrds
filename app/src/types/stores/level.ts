// src/types/stores/level.ts
export interface LevelStoreState {
  level: number
  lives: number
  isLevelTransition: boolean
  isRespawning: boolean
}

export interface LevelStoreActions {
  incrementLevel: () => void
  handlePlayerDeath: () => Promise<boolean>
  resetLevel: () => void
}

export type LevelStore = LevelStoreState & LevelStoreActions
