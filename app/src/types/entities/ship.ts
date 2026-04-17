// src/types/entities/ship.ts
import { BaseEntity, Vector2D } from '../core'

export interface ShipConfig {
  position: Vector2D
  onDie?: () => void
  isRespawning?: boolean
}

export interface ShipState extends BaseEntity {
  rotationSpeed: number
  speed: number
  inertia: number
  lastShot: number
  isInvulnerable: boolean
  invulnerabilityTime: number
  onDie?: () => void
}

export interface ShipMethods {
  destroy: () => void
  rotate: (direction: 'LEFT' | 'RIGHT') => void
  accelerate: () => void
  shootBullet: () => void
  render: (state: GameScreenState) => void
}

export interface GameScreenState {
  context: CanvasRenderingContext2D
  screen: {
    width: number
    height: number
  }
  keys: {
    left: number
    right: number
    up: number
    space: number
  }
}
