// src/game/systems/ParticleSystem.ts
import {
  ParticleSystem,
  ParticleConfig,
  ParticleSystemConfig,
} from '@/types/entities/particle'
import { Vector2D } from '@/types/core'
import { randomNumBetween } from '@/utils/helpers'
import Particle from '../entities/Particle'

export class ParticleSystemImpl implements ParticleSystem {
  private maxParticles: number
  private particles: Particle[]
  private context: CanvasRenderingContext2D | null = null

  constructor(config: ParticleSystemConfig = {}) {
    this.maxParticles = config.maxParticles || 100
    this.particles = []
  }

  setContext(context: CanvasRenderingContext2D) {
    this.context = context
  }

  createParticle(args: ParticleConfig): Particle | null {
    if (this.particles.length >= this.maxParticles) {
      // Replace oldest particle
      const oldestParticle = this.particles[0]
      oldestParticle.init(args)
      this.particles.push(this.particles.shift()!)
      return oldestParticle
    }

    const particle = new Particle(args)
    this.particles.push(particle)
    return particle
  }

  update() {
    if (!this.context) return

    this.particles = this.particles.filter((particle) => {
      if (particle.delete) return false
      particle.render({ context: this.context })
      return true
    })
  }

  createExplosion(position: Vector2D, radius: number, count: number): void {
    const particleCount = Math.min(count, 8)

    for (let i = 0; i < particleCount; i++) {
      this.createParticle({
        size: randomNumBetween(1, 2),
        position: {
          x: position.x + randomNumBetween(-radius / 4, radius / 4),
          y: position.y + randomNumBetween(-radius / 4, radius / 4),
        },
        velocity: {
          x: randomNumBetween(-1.5, 1.5),
          y: randomNumBetween(-1.5, 1.5),
        },
        lifeSpan: randomNumBetween(15, 25),
      })
    }
  }

  createThrusterParticle(position: Vector2D, posDelta: Vector2D): void {
    this.createParticle({
      size: randomNumBetween(1, 2),
      position: {
        x: position.x + posDelta.x + randomNumBetween(-2, 2),
        y: position.y + posDelta.y + randomNumBetween(-2, 2),
      },
      velocity: {
        x: posDelta.x / randomNumBetween(3, 5),
        y: posDelta.y / randomNumBetween(3, 5),
      },
      lifeSpan: randomNumBetween(15, 30),
    })
  }

  releaseParticle(particle: Particle): void {
    this.particles = this.particles.filter((p) => p !== particle)
  }
}

export const particleSystem = new ParticleSystemImpl({ maxParticles: 30 }) // Reduced max particles
