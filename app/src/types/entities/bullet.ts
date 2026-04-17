// src/types/entities/bullet.ts
import { BaseEntity, Vector2D } from '../core'

export interface BulletConfig {
  ship: {
    position: Vector2D
    rotation: number
  }
  rotation?: number
  radius?: number
  power?: number
  speed?: number
  color?: string
  piercing?: boolean
  lifeSpan?: number
}

export interface BulletState extends BaseEntity {
  power: number
  color: string
  piercing: boolean
  lifeSpan: number
  createTime: number
}

export interface BulletMethods {
  init: (args: BulletConfig) => void
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
