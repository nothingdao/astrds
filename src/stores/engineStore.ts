// src/stores/engineStore.ts
import { create } from 'zustand'
import { randomNumBetween } from '@/utils/helpers'
import { usePowerupStore } from './powerupStore'
import { useStateMachine } from './stateMachine'
import Bullet from '../game/entities/Bullet'
import Asteroid from '../game/entities/Asteroid'
import Pill from '../game/entities/Pill'
import Token from '../game/entities/Token'
import ShipPickup from '../game/entities/ShipPickup'
import {
  EngineStore,
  EngineStoreState,
  EntityGroup,
  EngineEntities,
} from '@/types/stores/engine'
import { PowerupStore } from '@/types/stores/powerup'
import { Vector2D } from '@/types/core'
import { MachineState } from '@/types/machine'
import { particleSystem } from '@/game/systems/ParticleSystem'
import { useInventoryStore } from './inventoryStore'
import { useGameData } from './gameData'
import { audioService } from '@/services/audio/AudioService'
import { useLevelStore } from './levelStore'

// Performance monitoring
interface PerformanceMetrics {
  fps: number
  frameTime: number
  lastFrameTimestamp: number
  frameCount: number
  entityCounts: Record<EntityGroup, number>
}

const INITIAL_STATE: EngineStoreState = {
  entities: {
    ship: [],
    asteroids: [],
    bullets: [],
    particles: [],
    pills: [],
    tokens: [],
    shipPickups: [],
  },
  screen: {
    width: window.innerWidth,
    height: window.innerHeight,
    ratio: window.devicePixelRatio || 1,
  },
  context: null,
  keys: {
    left: 0,
    right: 0,
    up: 0,
    space: 0,
  },
  lastShot: 0,
  asteroidCount: 2,
  lastPillSpawn: 0,
  pillSpawnDelay: 3000,
  lastShipPickupSpawn: Date.now(),
  shipPickupInterval: 20000,
  lastTokenSpawn: Date.now(),
  tokenSpawnDelay: 5000,
  powerupTimeout: null,
  gameLoopId: null,
  performance: {
    fps: 0,
    frameTime: 0,
    lastFrameTimestamp: performance.now(),
    frameCount: 0,
    entityCounts: {
      ship: 0,
      asteroids: 0,
      bullets: 0,
      particles: 0,
      pills: 0,
      tokens: 0,
      shipPickups: 0,
    },
  },
}

// Entity management helpers
const entityManagement = {
  validateEntity: <T extends EntityGroup>(
    entity: EngineEntities[T][number],
    group: T
  ): boolean => {
    if (!entity || !entity.id) {
      console.error(`Invalid entity for group ${group}:`, entity)
      return false
    }
    return true
  },

  updateEntityCounts: (
    state: EngineStoreState
  ): Record<EntityGroup, number> => {
    return Object.entries(state.entities).reduce(
      (counts, [group, entities]) => ({
        ...counts,
        [group]: entities.length,
      }),
      {} as Record<EntityGroup, number>
    )
  },
}

// Performance monitoring helpers
const performanceMonitoring = {
  updateMetrics: (state: EngineStoreState): PerformanceMetrics => {
    const now = performance.now()
    const frameTime = now - state.performance.lastFrameTimestamp
    const newFrameCount = state.performance.frameCount + 1

    // Calculate FPS over last second
    const fps = Math.round(1000 / frameTime)

    return {
      fps,
      frameTime,
      lastFrameTimestamp: now,
      frameCount: newFrameCount,
      entityCounts: entityManagement.updateEntityCounts(state),
    }
  },

  logSlowFrame: (frameTime: number) => {
    if (frameTime > 16.67) {
      console.warn(`Slow frame detected: ${Math.round(frameTime)}ms`)
    }
  },
}

export const useEngineStore = create<EngineStore>((set, get) => ({
  ...INITIAL_STATE,

  // Initialization and cleanup
  initializeEngine: (context: CanvasRenderingContext2D) => {
    if (!context) {
      throw new Error('Cannot initialize engine without context')
    }
    set({ context })
    particleSystem.setContext(context)
  },

  cleanup: () => {
    const state = get()
    if (state.gameLoopId) {
      cancelAnimationFrame(state.gameLoopId)
    }
    if (state.powerupTimeout) {
      clearTimeout(state.powerupTimeout)
    }
    set(INITIAL_STATE)
  },

  // Entity management
  addEntity: <T extends EntityGroup>(
    entity: EngineEntities[T][number],
    group: T
  ) => {
    if (!entityManagement.validateEntity(entity, group)) return

    set((state) => ({
      entities: {
        ...state.entities,
        [group]: [...state.entities[group], entity],
      },
      performance: {
        ...state.performance,
        entityCounts: entityManagement.updateEntityCounts({
          ...state,
          entities: {
            ...state.entities,
            [group]: [...state.entities[group], entity],
          },
        }),
      },
    }))
  },

  removeEntity: (entityId: string, group: EntityGroup) => {
    set((state) => ({
      entities: {
        ...state.entities,
        [group]: state.entities[group].filter(
          (entity) => entity.id !== entityId
        ),
      },
      performance: {
        ...state.performance,
        entityCounts: entityManagement.updateEntityCounts({
          ...state,
          entities: {
            ...state.entities,
            [group]: state.entities[group].filter(
              (entity) => entity.id !== entityId
            ),
          },
        }),
      },
    }))
  },

  // Input handling
  setKey: (key: keyof EngineStoreState['keys'], value: number) => {
    set((state) => ({
      keys: { ...state.keys, [key]: value },
    }))
  },

  // Collision detection
  checkCollision: (
    obj1: { position: Vector2D; radius: number },
    obj2: { position: Vector2D; radius: number }
  ): boolean => {
    const vx = obj1.position.x - obj2.position.x
    const vy = obj1.position.y - obj2.position.y
    const length = Math.sqrt(vx * vx + vy * vy)
    return length < obj1.radius + obj2.radius
  },

  checkCollisions: () => {
    const state = get()
    const { bullets, asteroids, pills, tokens, shipPickups, ship } =
      state.entities
    const currentShip = ship[0]
    const gameData = useGameData.getState()

    // Early exit if no ship
    if (!currentShip) return

    // Ship-Token collisions
    tokens.forEach((token) => {
      if (state.checkCollision(currentShip, token)) {
        useInventoryStore.getState().addItem('tokens', 1)
        token.destroy()
        audioService.playSound('collect')
      }
    })

    // Ship-Pill collisions
    pills.forEach((pill) => {
      if (state.checkCollision(currentShip, pill)) {
        pill.destroy()
        const powerupStore = usePowerupStore.getState()
        if (typeof powerupStore.activatePowerup === 'function') {
          powerupStore.activatePowerup(pill.type)
        }

        // Optionally play collection sound effect
        audioService.playSound('collect')
      }
    })

    // Ship-Pickup collisions
    shipPickups.forEach((pickup) => {
      if (state.checkCollision(currentShip, pickup)) {
        pickup.destroy()
        useInventoryStore.getState().addItem('ships', 1)

        // Optionally play collection sound effect
        audioService.playSound('collect')
      }
    })

    // Ship-Asteroid collisions (keep this one dangerous!)
    asteroids.forEach((asteroid) => {
      if (state.checkCollision(currentShip, asteroid)) {
        currentShip.destroy()
        asteroid.destroy()
      }
    })

    // Bullet-Asteroid collisions
    bullets.forEach((bullet) => {
      asteroids.forEach((asteroid) => {
        if (state.checkCollision(bullet, asteroid)) {
          bullet.destroy()
          asteroid.destroy()
          const gameStore = useGameData.getState()
          if (typeof gameStore.addToScore === 'function') {
            gameStore.addToScore(asteroid.score)
          }
        }
      })
    })
  },

  // Game loop management
  updateGame: () => {
    const state = get()
    if (!state.context) return

    const startTime = performance.now()

    try {
      // Clear and setup context
      state.context.save()
      state.context.scale(state.screen.ratio, state.screen.ratio)
      state.context.fillStyle = '#000'
      state.context.globalAlpha = 0.4
      state.context.fillRect(0, 0, state.screen.width, state.screen.height)
      state.context.globalAlpha = 1

      // We check for cleared asteroids, then increment level, spawn new asteroids, party!
      if (state.entities.asteroids.length === 0) {
        const levelStore = useLevelStore.getState()
        if (!levelStore.isRespawning) {
          // Add this check
          levelStore.incrementLevel()

          set((state) => ({
            asteroidCount: Math.min(state.asteroidCount + 1, 10),
          }))
          state.spawnAsteroids(state.asteroidCount)
        }
      }

      // Update spawners
      state.spawnPill()
      state.spawnToken()
      state.spawnShipPickup()

      // Render entities
      Object.entries(state.entities).forEach(([group, entities]) => {
        entities.forEach((entity) => {
          if (entity.delete) {
            state.removeEntity(entity.id, group as EntityGroup)
          } else {
            try {
              entity.render(state)
            } catch (error) {
              console.error(`Error rendering ${group} entity:`, error)
              state.removeEntity(entity.id, group as EntityGroup)
            }
          }
        })
      })

      // Update particle system
      particleSystem.update()

      // Handle input
      if (state.keys.space) {
        state.shootBullet()
      }

      // Check collisions
      state.checkCollisions()

      // Update performance metrics
      const metrics = performanceMonitoring.updateMetrics(state)
      set({ performance: metrics })

      state.context.restore()

      // Performance monitoring
      const frameTime = performance.now() - startTime
      performanceMonitoring.logSlowFrame(frameTime)
    } catch (error) {
      console.error('Error in game loop:', error)
      state.cleanup()
      useStateMachine.getState().setState(MachineState.GAME_OVER)
    }
  },

  startGameLoop: () => {
    const state = get()
    if (state.gameLoopId || !state.context) {
      console.warn('Game loop already running or context missing')
      return
    }

    const loop = () => {
      const currentState = get()
      currentState.updateGame()
      const frameId = requestAnimationFrame(loop)
      set({ gameLoopId: frameId })
    }

    const frameId = requestAnimationFrame(loop)
    set({ gameLoopId: frameId })
  },

  resetEngine: () => {
    const state = get()
    state.cleanup()
    set(INITIAL_STATE)
  },

  togglePause: (shouldPause?: boolean) => {
    const currentState = get()
    const newPauseState =
      shouldPause !== undefined ? shouldPause : !currentState.gameLoopId

    if (newPauseState) {
      currentState.stopGameLoop()
    } else {
      currentState.startGameLoop()
    }
  },

  stopGameLoop: () => {
    const state = get()
    if (state.gameLoopId) {
      cancelAnimationFrame(state.gameLoopId)
      set({ gameLoopId: null })
    }
  },

  // Spawn management
  spawnAsteroids: (count: number) => {
    const state = get()
    const ship = state.entities.ship[0]
    if (!ship) return

    for (let i = 0; i < count; i++) {
      try {
        const asteroidX = randomNumBetween(0, state.screen.width)
        const asteroidY = randomNumBetween(0, state.screen.height)

        // Prevent spawning too close to ship
        if (
          Math.abs(asteroidX - ship.position.x) < 100 &&
          Math.abs(asteroidY - ship.position.y) < 100
        ) {
          i--
          continue
        }

        const asteroid = new Asteroid({
          size: 40,
          position: { x: asteroidX, y: asteroidY },
        })

        state.addEntity(asteroid, 'asteroids')
      } catch (error) {
        console.error('Error spawning asteroid:', error)
      }
    }
  },

  // Other spawn methods follow similar pattern...
  spawnPill: () => {
    const state = get()
    const now = Date.now()

    if (now - state.lastPillSpawn > state.pillSpawnDelay) {
      try {
        const pill = new Pill({
          screen: state.screen,
          type: 'standard',
        })
        state.addEntity(pill, 'pills')
        set({ lastPillSpawn: now })
      } catch (error) {
        console.error('Error spawning pill:', error)
      }
    }
  },

  spawnToken: () => {
    const state = get()
    const now = Date.now()

    if (now - state.lastTokenSpawn > state.tokenSpawnDelay) {
      try {
        const token = new Token({
          screen: state.screen,
          type: 'standard',
        })
        state.addEntity(token, 'tokens')
        set({ lastTokenSpawn: now })
      } catch (error) {
        console.error('Error spawning token:', error)
      }
    }
  },

  spawnShipPickup: () => {
    const state = get()
    const now = Date.now()

    if (
      state.entities.shipPickups.length === 0 &&
      now - state.lastShipPickupSpawn >= state.shipPickupInterval
    ) {
      try {
        const pickup = new ShipPickup({
          screen: state.screen,
        })
        state.addEntity(pickup, 'shipPickups')
        set({ lastShipPickupSpawn: now })
      } catch (error) {
        console.error('Error spawning ship pickup:', error)
      }
    }
  },

  // Weapon system
  shootBullet: () => {
    const state = get()
    const ship = state.entities.ship[0]
    const powerupState = usePowerupStore.getState() as PowerupStore
    const { rapidFire } = powerupState.powerups

    if (!ship || ship.delete) return

    const now = Date.now()
    const shootDelay = rapidFire ? 50 : 250

    if (now - state.lastShot > shootDelay) {
      try {
        const bullet = new Bullet({
          ship,
          power: rapidFire ? 2 : 1,
        })
        state.addEntity(bullet, 'bullets')
        set({ lastShot: now })
      } catch (error) {
        console.error('Error creating bullet:', error)
      }
    }
  },
}))
