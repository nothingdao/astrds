// src/game/entities/ShipPickup.ts
import {
  ShipPickupConfig,
  ShipPickupState,
  ShipPickupMethods,
  GameScreenState,
} from '@/types/entities/shipPickup'
import { Vector2D } from '@/types/core'

export default class ShipPickup implements ShipPickupState, ShipPickupMethods {
  public id: string
  public position: Vector2D
  public velocity: Vector2D
  public rotation: number
  public radius: number
  public delete: boolean

  constructor(args: ShipPickupConfig) {
    this.id = `ship-pickup-${Date.now()}-${Math.random()}`
    this.position = {
      x: Math.floor(Math.random() * args.screen.width),
      y: Math.floor(Math.random() * args.screen.height),
    }
    this.radius = 20
    this.delete = false
    this.velocity = { x: 0, y: 0 }
    this.rotation = 0
  }

  destroy(): void {
    this.delete = true
  }

  render(state: GameScreenState): void {
    const context = state.context

    context.save()
    context.translate(this.position.x, this.position.y)

    // Draw a filled circle behind the ship shape (no pulsing effect)
    context.beginPath()
    context.arc(0, 0, this.radius - 5, 0, Math.PI * 2) // Slightly smaller radius
    context.fillStyle = '#87CEEB' // Light blue fill color
    context.fill() // Fill the circle

    // Draw a glowing white outline for the circle
    context.strokeStyle = '#FFFFFF'
    context.lineWidth = 1 // Outline thickness
    context.shadowBlur = 10 // Glow effect
    context.shadowColor = '#FFFFFF'
    context.stroke() // Draw only the outline, no fill

    // Reset shadow settings for the ship shape
    context.shadowBlur = 0

    // Draw the ship shape with a blue outline only, no fill
    context.strokeStyle = '#1E90FF' // Solid blue outline
    context.lineWidth = 1 // Thin outline

    // Make the ship shape larger than the circle
    const scaleFactor = 1.3 // Scale factor for making the ship bigger
    context.beginPath()
    context.moveTo(0, -15 * scaleFactor) // Top point
    context.lineTo(10 * scaleFactor, 10 * scaleFactor) // Right point
    context.lineTo(5 * scaleFactor, 7 * scaleFactor) // Inner right point
    context.lineTo(-5 * scaleFactor, 7 * scaleFactor) // Inner left point
    context.lineTo(-10 * scaleFactor, 10 * scaleFactor) // Left point
    context.closePath()
    context.stroke() // Outline only, no fill

    context.restore()
  }
}
