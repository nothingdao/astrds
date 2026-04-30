// src/types/stores/engine.ts
import { Vector2D } from "../core";
import { AsteroidState, AsteroidMethods } from "../entities/asteroid";
import { BulletState, BulletMethods } from "../entities/bullet";
import { ParticleState, ParticleMethods } from "../entities/particle";
import { PillState, PillMethods } from "../entities/pill";
import { TokenState, TokenMethods } from "../entities/token";
import { ShipState, ShipMethods } from "../entities/ship";
import { ShipPickupState, ShipPickupMethods } from "../entities/shipPickup";

// Entity type combinations
export type Ship = ShipState & ShipMethods;
export type Asteroid = AsteroidState & AsteroidMethods;
export type Bullet = BulletState & BulletMethods;
export type Particle = ParticleState & ParticleMethods;
export type Pill = PillState & PillMethods;
export type Token = TokenState & TokenMethods;
export type ShipPickup = ShipPickupState & ShipPickupMethods;

export interface EngineEntities {
  ship: Ship[];
  asteroids: Asteroid[];
  bullets: Bullet[];
  particles: Particle[];
  pills: Pill[];
  tokens: Token[];
  shipPickups: ShipPickup[];
}

export type EntityGroup = keyof EngineEntities;

export interface EngineScreen {
  width: number;
  height: number;
  ratio: number;
}

export interface EnginePerformance {
  fps: number;
  frameTime: number;
  entityCounts: Record<string, number>;
  frameCount: number;
  lastFrameTimestamp: number;
}

export interface EngineStoreState {
  entities: EngineEntities;
  screen: EngineScreen;
  context: CanvasRenderingContext2D | null;
  keys: {
    left: number;
    right: number;
    up: number;
    space: number;
  };
  lastShot: number;
  asteroidCount: number;
  powerupTimeout: NodeJS.Timeout | null;
  lastPillSpawn: number;
  pillSpawnDelay: number;
  lastTokenSpawn: number;
  tokenSpawnDelay: number;
  lastShipPickupSpawn: number;
  shipPickupInterval: number;
  gameLoopId: number | null;
  devFastSpawn: boolean;
  performance: EnginePerformance;
}

export interface EngineStoreActions {
  initializeEngine: (context: CanvasRenderingContext2D) => void;
  cleanup: () => void;
  addEntity: <T extends EntityGroup>(
    entity: EngineEntities[T][number],
    group: T
  ) => void;
  removeEntity: (entityId: string, group: EntityGroup) => void;
  setKey: (key: keyof EngineStoreState["keys"], value: number) => void;
  checkCollision: (
    obj1: { position: Vector2D; radius: number },
    obj2: { position: Vector2D; radius: number }
  ) => boolean;
  checkCollisions: () => void;
  shootBullet: () => void;
  updateGame: () => void;
  startGameLoop: () => void;
  stopGameLoop: () => void;
  spawnAsteroids: (count: number) => void;
  spawnPill: () => void;
  spawnToken: () => void;
  spawnShipPickup: () => void;
  resetEngine: () => void;
  togglePause: (shouldPause?: boolean) => void;
  setDevFastSpawn: (enabled: boolean) => void;
}

export type EngineStore = EngineStoreState & EngineStoreActions;
