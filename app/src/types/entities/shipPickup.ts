// src/types/entities/shipPickup.ts
import { BaseEntity, Vector2D } from '../core'

export interface ShipPickupConfig {
  screen: {
    width: number
    height: number
  }
}

export interface ShipPickupState extends BaseEntity {
  // No additional state properties needed beyond BaseEntity
}

export interface ShipPickupMethods {
  destroy: () => void
  render: (state: GameScreenState) => void
}

export interface GameScreenState {
  context: CanvasRenderingContext2D
  screen: {
    width: number
    height: number
  }
}
