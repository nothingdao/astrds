// src/types/entities/asteroid.ts
import { BaseEntity, Vector2D } from '../core'

export interface AsteroidConfig {
  position: Vector2D
  size: number
}

export interface AsteroidState extends BaseEntity {
  rotationSpeed: number
  score: number
  vertices: Vector2D[]
}

export interface AsteroidMethods {
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
