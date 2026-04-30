// src/types/entities/asteroid.ts
import { BaseEntity, ScreenBounds, Vector2D } from "../core";

export interface AsteroidConfig {
  position: Vector2D;
  size: number;
}

export interface AsteroidState extends BaseEntity {
  rotationSpeed: number;
  score: number;
  vertices: Vector2D[];
}

export interface AsteroidMethods {
  destroy: () => void;
  update: (dt: number, screen: ScreenBounds) => void;
  render: (context: CanvasRenderingContext2D) => void;
}
