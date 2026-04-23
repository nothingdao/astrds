// src/types/entities/pill.ts
import { BaseEntity, Vector2D } from '../core'

export interface PillConfig {
  screen: {
    width: number
    height: number
  }
  type?: string
}

export interface PillState extends BaseEntity {
  type: string
  timeToLive: number
  creation: number
  color: string
}

export interface PillMethods {
  destroy: () => void
  update: (dt: number) => void
  render: (context: CanvasRenderingContext2D) => void
}
