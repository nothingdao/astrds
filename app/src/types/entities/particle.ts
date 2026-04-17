// src/types/entities/particle.ts
import { BaseEntity, Vector2D } from '../core'

// Updated Particle type to match the class implementation
export interface Particle extends ParticleState, ParticleMethods {
  id: string
  position: Vector2D
  velocity: Vector2D
  radius: number
  rotation: number
  lifeSpan: number
  inertia: number
  delete: boolean
  init: (args: ParticleConfig) => void
  destroy: () => void
  render: (state: GameScreenState) => void
}

export interface ParticleConfig {
  position: Vector2D
  velocity: Vector2D
  size: number
  lifeSpan: number
}

export interface ParticlePoolItem {
  particle: Particle | null
  active: boolean
  createTime: number
}

export interface ParticleState extends BaseEntity {
  inertia: number
  lifeSpan: number
}

export interface ParticleMethods {
  init: (args: ParticleConfig) => void
  destroy: () => void
  render: (state: GameScreenState) => void
}

export interface GameScreenState {
  context: CanvasRenderingContext2D
}

export interface ParticleSystemConfig {
  maxParticles?: number
}

export interface ParticleEmissionConfig {
  position: Vector2D
  velocity?: Vector2D
  size?: number
  lifeSpan?: number
  count?: number
  spread?: number
  color?: string
}

export interface ParticleSystem {
  createParticle: (config: ParticleConfig) => Particle | null
  releaseParticle: (particle: Particle) => void
  createExplosion: (position: Vector2D, radius: number, count: number) => void
  createThrusterParticle: (position: Vector2D, posDelta: Vector2D) => void
}
