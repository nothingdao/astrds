// src/game/entities/Token.ts
import { randomNumBetween } from '@/utils/helpers'
import {
  TokenConfig,
  TokenState,
  TokenMethods,
  GameScreenState,
  TokenMetadata,
} from '@/types/entities/token'
import { Vector2D } from '@/types/core'

export default class Token implements TokenState, TokenMethods {
  public id: string
  public position: Vector2D
  public velocity: Vector2D
  public rotation: number
  public radius: number
  public delete: boolean
  public type: string = 'ASTRDS' // Default token symbol
  public timeToLive: number
  public creation: number
  public color: string
  public metadata: TokenMetadata
  public isPendingCollection: boolean = false // Initialize the new property

  constructor(args: TokenConfig) {
    this.id = `token-${Date.now()}-${Math.random()}`
    this.radius = 8
    this.delete = false

    // Position calculation from screen edge
    const edge = Math.floor(Math.random() * 4)
    const screen = args.screen

    switch (edge) {
      case 0: // Top
        this.position = {
          x: Math.random() * screen.width,
          y: -this.radius,
        }
        break
      case 1: // Right
        this.position = {
          x: screen.width + this.radius,
          y: Math.random() * screen.height,
        }
        break
      case 2: // Bottom
        this.position = {
          x: Math.random() * screen.width,
          y: screen.height + this.radius,
        }
        break
      case 3: // Left
        this.position = {
          x: -this.radius,
          y: Math.random() * screen.height,
        }
        break
    }

    this.velocity = {
      x: randomNumBetween(-1.5, 1.5),
      y: randomNumBetween(-1.5, 1.5),
    }

    this.type = args.type || 'standard'
    this.timeToLive = 15 * 1000 // 15 seconds lifetime
    this.creation = Date.now()
    this.color = args.color ?? '#FF642D'
    this.rotation = 0

    this.metadata = args.metadata || {
      symbol: 'ASTRDS',
      value: 1,
      mineable: true,
    }
  }

  destroy(): void {
    this.delete = true
  }

  render(state: GameScreenState): void {
    // Move
    this.position.x += this.velocity.x
    this.position.y += this.velocity.y

    // Screen wrapping
    if (this.position.x > state.screen.width + this.radius)
      this.position.x = -this.radius
    else if (this.position.x < -this.radius)
      this.position.x = state.screen.width + this.radius
    if (this.position.y > state.screen.height + this.radius)
      this.position.y = -this.radius
    else if (this.position.y < -this.radius)
      this.position.y = state.screen.height + this.radius

    // Check if token should expire
    if (Date.now() - this.creation > this.timeToLive) {
      this.destroy()
      return
    }

    // Draw simple outline (No pulse, no fill)
    const context = state.context
    context.save()
    context.translate(this.position.x, this.position.y)

    context.strokeStyle = this.color // Outline color
    context.lineWidth = 2 // Outline thickness
    context.beginPath()
    context.arc(0, 0, this.radius, 0, 2 * Math.PI)
    context.stroke()

    context.restore()
  }
}
