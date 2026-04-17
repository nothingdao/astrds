// src/game/entities/Asteroid.ts
import { asteroidVertices, randomNumBetween } from '@/utils/helpers'
import { useGameData } from '../../stores/gameData'
import { useEngineStore } from '../../stores/engineStore'
import { particleSystem } from '../systems/ParticleSystem'
import { audioService } from '../../services/audio/AudioService'
import {
  AsteroidConfig,
  AsteroidState,
  AsteroidMethods,
  GameScreenState,
} from '@/types/entities/asteroid'
import { Vector2D } from '@/types/core'

export default class Asteroid implements AsteroidState, AsteroidMethods {
  public id: string
  public position: Vector2D
  public velocity: Vector2D
  public rotation: number
  public rotationSpeed: number
  public radius: number
  public score: number
  public vertices: Vector2D[]
  public delete: boolean

  constructor(args: AsteroidConfig) {
    this.id = `asteroid-${Date.now()}-${Math.random()}`
    this.position = args.position
    this.velocity = {
      x: randomNumBetween(-1.5, 1.5),
      y: randomNumBetween(-1.5, 1.5),
    }
    this.rotation = 0
    this.rotationSpeed = randomNumBetween(-1, 1)
    this.radius = args.size
    this.score = Math.floor((80 / Math.max(1, this.radius)) * 5)
    this.vertices = asteroidVertices(8, args.size)
    this.delete = false
  }

  destroy(): void {
    this.delete = true
    audioService.playSound('explosion')

    // Add points using the store
    const gameStore = useGameData.getState()
    const scoreToAdd = Math.max(0, Math.floor(this.score))
    gameStore.addToScore(scoreToAdd)

    // Use particleSystem instead of directly creating particles
    particleSystem.createExplosion(
      this.position,
      this.radius,
      Math.floor(this.radius) // Particle count scales with asteroid size
    )

    // Break into smaller asteroids
    if (this.radius > 10) {
      for (let i = 0; i < 2; i++) {
        const newAsteroid = new Asteroid({
          size: this.radius / 2,
          position: {
            x: randomNumBetween(-10, 20) + this.position.x,
            y: randomNumBetween(-10, 20) + this.position.y,
          },
        })
        useEngineStore.getState().addEntity(newAsteroid, 'asteroids')
      }
    }
  }

  render(state: GameScreenState): void {
    // Move
    this.position.x += this.velocity.x
    this.position.y += this.velocity.y

    // Rotation
    this.rotation += this.rotationSpeed
    if (this.rotation >= 360) {
      this.rotation -= 360
    }
    if (this.rotation < 0) {
      this.rotation += 360
    }

    // Screen wrapping
    if (this.position.x > state.screen.width + this.radius)
      this.position.x = -this.radius
    else if (this.position.x < -this.radius)
      this.position.x = state.screen.width + this.radius
    if (this.position.y > state.screen.height + this.radius)
      this.position.y = -this.radius
    else if (this.position.y < -this.radius)
      this.position.y = state.screen.height + this.radius

    // Draw
    const context = state.context
    context.save()
    context.translate(this.position.x, this.position.y)
    context.rotate((this.rotation * Math.PI) / 180)
    context.strokeStyle = '#FFF'
    context.lineWidth = 0.4
    context.beginPath()
    context.moveTo(0, -this.radius)
    for (let i = 1; i < this.vertices.length; i++) {
      context.lineTo(this.vertices[i].x, this.vertices[i].y)
    }
    context.closePath()
    context.stroke()
    context.restore()
  }
}
