// src/types/entities/ship.ts
import { BaseEntity, ScreenBounds, Vector2D } from "../core";

export interface ShipConfig {
  position: Vector2D;
  onDie?: () => void;
  isRespawning?: boolean;
}

export interface ShipState extends BaseEntity {
  rotationSpeed: number;
  speed: number;
  inertia: number;
  lastShot: number;
  isInvulnerable: boolean;
  invulnerabilityTime: number;
  onDie?: () => void;
}

export interface ShipMethods {
  destroy: () => void;
  rotate: (direction: "LEFT" | "RIGHT") => void;
  accelerate: () => void;
  stopThrust: () => void;
  shootBullet: () => void;
  update: (dt: number, screen: ScreenBounds) => void;
  render: (context: CanvasRenderingContext2D) => void;
}
