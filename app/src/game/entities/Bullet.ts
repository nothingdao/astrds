// src/game/entities/Bullet.ts
import { rotatePoint } from '@/utils/helpers'
import { bulletSystem } from '../systems/BulletSystem'
import { audioService } from '../../services/audio/AudioService'
import {
  BulletConfig,
  BulletState,
  BulletMethods,
  GameScreenState,
} from '@/types/entities/bullet'
import { Vector2D } from '@/types/core'

export default class Bullet implements BulletState, BulletMethods {
  public id: string
  public position: Vector2D
  public velocity: Vector2D
  public rotation: number
  public radius: number
  public power: number
  public color: string
  public piercing: boolean
  public lifeSpan: number
  public createTime: number
  public delete: boolean

  constructor(args: BulletConfig) {
    this.id = `bullet-${Date.now()}-${Math.random()}`
    this.init(args)
  }

  init(args: BulletConfig): void {
    const {
      ship,
      rotation = args.ship.rotation,
      radius = 4,
      power = 10,
      speed = 25,
      color = '#fff',
      piercing = false,
      lifeSpan = 55,
    } = args

    // Calculate bullet position relative to ship
    const posDelta = rotatePoint(
      { x: 0, y: -20 },
      { x: 0, y: 0 },
      (rotation * Math.PI) / 180
    )

    this.position = {
      x: ship.position.x + posDelta.x,
      y: ship.position.y + posDelta.y,
    }

    this.rotation = rotation
    this.velocity = {
      x: ((posDelta.x / 2) * speed) / 10,
      y: ((posDelta.y / 2) * speed) / 10,
    }

    this.radius = radius
    this.power = power
    this.color = color
    this.piercing = piercing
    this.lifeSpan = lifeSpan
    this.delete = false
    this.createTime = Date.now()

    audioService.playSound('shoot')
  }

  destroy(): void {
    this.delete = true
    bulletSystem.releaseBullet(this)
  }

  render(state: GameScreenState): void {
    // Force cleanup old bullets
    if (Date.now() - this.createTime > 1000) {
      this.destroy()
      return
    }

    // Move
    this.position.x += this.velocity.x
    this.position.y += this.velocity.y

    // Check lifespan
    if (this.lifeSpan && --this.lifeSpan <= 0) {
      this.destroy()
      return
    }

    // Delete if it goes out of bounds
    if (
      this.position.x < 0 ||
      this.position.y < 0 ||
      this.position.x > state.screen.width ||
      this.position.y > state.screen.height
    ) {
      this.destroy()
      return
    }

    // Draw
    const context = state.context
    context.save()
    context.translate(this.position.x, this.position.y)
    context.rotate((this.rotation * Math.PI) / 180)
    context.fillStyle = this.color
    context.lineWidth = 0.5
    context.beginPath()
    context.arc(0, 0, this.radius, 0, 2 * Math.PI)
    context.closePath()
    context.fill()

    // Add glow effect for powered-up bullets
    if (this.power > 1) {
      context.shadowColor = this.color
      context.shadowBlur = this.power * 2 // Scale glow with power
      context.fill()
    }

    context.restore()
  }
}
