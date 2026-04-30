// src/types/entities/shipPickup.ts
import { BaseEntity, ScreenBounds, Vector2D } from "../core";

export interface ShipPickupConfig {
  screen: {
    width: number;
    height: number;
  };
}

export interface ShipPickupState extends BaseEntity {
  // No additional state properties needed beyond BaseEntity
}

export interface ShipPickupMethods {
  destroy: () => void;
  update: (dt: number, screen: ScreenBounds) => void;
  render: (context: CanvasRenderingContext2D) => void;
}
