export interface Vector2D {
  x: number
  y: number
}

export interface ScreenBounds {
  width: number
  height: number
}

export interface InputState {
  left: boolean
  right: boolean
  up: boolean
  space: boolean
}

export interface ShipSnapshot {
  id: string
  position: Vector2D
  velocity: Vector2D
  rotation: number
  radius: number
  isInvulnerable: boolean
}

export interface AsteroidSnapshot {
  id: string
  position: Vector2D
  velocity: Vector2D
  rotation: number
  radius: number
  score: number
  vertices: Vector2D[]
}

export interface BulletSnapshot {
  id: string
  position: Vector2D
  velocity: Vector2D
  rotation: number
  radius: number
  power: number
  color: string
}

export type PickupKind = 'pill' | 'token' | 'shipPickup'

export interface PickupSnapshot {
  id: string
  kind: PickupKind
  position: Vector2D
  velocity: Vector2D
  rotation: number
  radius: number
  color: string
}

export interface PowerupSnapshot {
  invincible: boolean
  rapidFire: boolean
  expiresAt: number | null
}

export interface EmissionTier {
  tier: 1 | 2 | 3 | 4 | 5
  pillsPerGame: number
  astrdsPerPill: number
}

export interface SpaceTokenPool {
  depositId: string
  mintAddress: string
  symbol: string
  remainingAmount: number
  tokensPerPill: number
  color: string
}

export interface AuthorizedSpaceTokenSpawn {
  depositId: string
  mintAddress: string
  spawnId: string
  color: string
}

export interface GameSnapshot {
  sessionId: string
  tick: number
  status: 'playing' | 'gameOver'
  screen: ScreenBounds
  score: number
  level: number
  lives: number
  pillsCollected: number
  tokensCollected: number
  ship: ShipSnapshot | null
  asteroids: AsteroidSnapshot[]
  bullets: BulletSnapshot[]
  pills: PickupSnapshot[]
  tokens: PickupSnapshot[]
  shipPickups: PickupSnapshot[]
  powerups: PowerupSnapshot
}

export interface SessionBinding {
  walletAddress?: string | null
  gameSessionId?: string | null
}

export type SimulationEvent =
  | { type: 'pillCollected' }
  | { type: 'shipPickupCollected' }
  | {
      type: 'spaceTokenSpawnRequested'
      pool: SpaceTokenPool
    }
  | {
      type: 'tokenCollected'
      source: 'standard' | 'space'
      spawnId?: string
      depositId?: string
      mintAddress?: string
    }

export type ClientToServerMessage =
  | { type: 'hello'; screen: ScreenBounds; session?: SessionBinding }
  | { type: 'resize'; screen: ScreenBounds }
  | { type: 'input'; input: Partial<InputState> }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'reset' }
  | { type: 'ping'; at: number }

export type ServerToClientMessage =
  | { type: 'welcome'; sessionId: string; snapshot: GameSnapshot }
  | { type: 'state'; snapshot: GameSnapshot }
  | { type: 'gameOver'; snapshot: GameSnapshot }
  | { type: 'pong'; at: number }
  | { type: 'error'; message: string }
