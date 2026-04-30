// src/game/entities/Particle.ts
import { particleSystem } from "../systems/ParticleSystem";
import {
  ParticleConfig,
  ParticleState,
  ParticleMethods,
} from "@/types/entities/particle";
import { ScreenBounds, Vector2D } from "@/types/core";
import { getCanvasTokens } from "@/lib/designTokens";

export default class Particle implements ParticleState, ParticleMethods {
  public id: string;
  public position: Vector2D;
  public velocity: Vector2D;
  public radius: number;
  public rotation: number;
  public lifeSpan: number;
  public inertia: number;
  public delete: boolean;

  constructor(args: ParticleConfig) {
    this.id = `particle-${Date.now()}-${Math.random()}`;
    this.init(args);
  }

  init(args: ParticleConfig): void {
    this.position = { ...args.position };
    this.velocity = { ...args.velocity };
    this.radius = args.size;
    this.lifeSpan = args.lifeSpan;
    this.inertia = 0.98;
    this.rotation = 0;
    this.delete = false;
  }

  destroy(): void {
    // console.log('Particle destroying:', this.id)
    this.delete = true;
    particleSystem.releaseParticle(this);
  }

  update(_dt: number, _screen: ScreenBounds): void {
    this.position.x += this.velocity.x;
    this.position.y += this.velocity.y;
    this.velocity.x *= this.inertia;
    this.velocity.y *= this.inertia;

    this.radius -= 0.1;
    if (this.radius < 0.1) {
      this.radius = 0.1;
    }

    if (this.lifeSpan-- < 0) {
      this.destroy();
    }
  }

  render(context: CanvasRenderingContext2D): void {
    if (!this.delete) {
      context.save();
      context.translate(this.position.x, this.position.y);
      context.fillStyle = getCanvasTokens().particle;
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(0, -this.radius);
      context.arc(0, 0, this.radius, 0, 2 * Math.PI);
      context.closePath();
      context.fill();
      context.restore();
    }
  }
}
