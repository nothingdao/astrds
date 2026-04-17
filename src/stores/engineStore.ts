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
import { useSpaceTokenStore } from './spaceTokenStore'
import { getTokenColor, ASTRDS_COLOR } from '@/lib/tokenColors'
import { convex } from '@/lib/convex'
import { api } from '../../convex/_generated/api'

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
  devFastSpawn: false,
}


// Module-level RAF id — kept outside Zustand so we never call set() per frame
let _rafId: number | null = null

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
    if (_rafId !== null) {
      cancelAnimationFrame(_rafId)
      _rafId = null
    }
    const state = get()
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
    if (!entity?.id) return
    set((state) => ({
      entities: {
        ...state.entities,
        [group]: [...state.entities[group], entity],
      },
    }))
  },

  removeEntity: (entityId: string, group: EntityGroup) => {
    set((state) => ({
      entities: {
        ...state.entities,
        [group]: state.entities[group].filter((e) => e.id !== entityId),
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
        if (token.type === 'space' && token.metadata.spawnId) {
          // Space token — validate the server-issued ticket and write a persistent
          // collection record. The ticket (spawnId) proves the server authorized
          // this spawn; no ticket = no collection, blocking bots.
          const { currentSessionId, walletAddress } = useGameData.getState()
          if (currentSessionId && walletAddress) {
            convex.mutation(api.spaceDeposits.collectFromDeposit, {
              spawnId: token.metadata.spawnId as any,
              playerWalletAddress: walletAddress,
              gameSessionId: currentSessionId as any,
            })
              .then((result) => {
                if (result.success) {
                  const pools = useSpaceTokenStore.getState().activePools
                  const deposit = pools.find((p) => p._id === token.metadata.depositId)
                  if (deposit) useSpaceTokenStore.getState().recordCollection(deposit)
                }
              })
              .catch(() => {})
          }
        } else if (token.type !== 'space') {
          useInventoryStore.getState().addItem('tokens', 1)
        }
        token.destroy()
        audioService.playSound('collect')
      }
    })

    // Ship-Pill collisions
    pills.forEach((pill) => {
      if (state.checkCollision(currentShip, pill)) {
        pill.destroy()
        usePowerupStore.getState().activatePowerups()
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

      // Level advance: all asteroids cleared
      if (state.entities.asteroids.length === 0) {
        const levelStore = useLevelStore.getState()
        if (!levelStore.isRespawning) {
          levelStore.incrementLevel()
          const nextCount = Math.min(state.asteroidCount + 1, 10)
          // Clear transient entities from previous level in one set() call
          set((s) => ({
            asteroidCount: nextCount,
            entities: {
              ...s.entities,
              bullets: [],
              pills: [],
              tokens: [],
              shipPickups: [],
            },
          }))
          get().spawnAsteroids(nextCount)
          state.context.restore()
          return
        }
      }

      // Update spawners
      state.spawnPill()
      state.spawnToken()
      state.spawnShipPickup()

      // Render pass + collect dead entities — ONE set() call per frame max
      const nextEntities: Partial<EngineEntities> = {}
      let hasDeleted = false

      Object.entries(state.entities).forEach(([group, entities]) => {
        const alive: typeof entities = []
        entities.forEach((entity) => {
          if (entity.delete) {
            hasDeleted = true
          } else {
            try {
              entity.render(state)
              alive.push(entity)
            } catch (error) {
              console.error(`Error rendering ${group} entity:`, error)
              hasDeleted = true
            }
          }
        })
        if (alive.length !== entities.length) {
          nextEntities[group as EntityGroup] = alive
        }
      })

      if (hasDeleted) {
        set((s) => ({ entities: { ...s.entities, ...nextEntities } }))
      }

      // Update particle system
      particleSystem.update()

      // Handle input
      if (state.keys.space) {
        state.shootBullet()
      }

      // Check collisions
      state.checkCollisions()

      state.context.restore()
    } catch (error) {
      console.error('Error in game loop:', error)
      state.cleanup()
      useStateMachine.getState().setState(MachineState.GAME_OVER)
    }
  },

  startGameLoop: () => {
    if (_rafId !== null || !get().context) return

    const loop = () => {
      get().updateGame()
      _rafId = requestAnimationFrame(loop)
    }

    _rafId = requestAnimationFrame(loop)
    set({ gameLoopId: _rafId }) // mark as running — only set once
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
    if (_rafId !== null) {
      cancelAnimationFrame(_rafId)
      _rafId = null
    }
    set({ gameLoopId: null })
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

  setDevFastSpawn: (enabled: boolean) => set({ devFastSpawn: enabled }),

  spawnToken: () => {
    const state = get()
    const now = Date.now()
    const delay = state.devFastSpawn ? 500 : state.tokenSpawnDelay

    if (now - state.lastTokenSpawn > delay) {
      set({ lastTokenSpawn: now }) // reset immediately to prevent re-entry

      try {
        const level = useLevelStore.getState().level
        const spaceStore = useSpaceTokenStore.getState()
        const eligiblePools = spaceStore.activePools.filter(
          (p) =>
            p.status === 'active' &&
            p.minLevel <= level &&
            p.maxLevel >= level &&
            p.remainingAmount >= p.tokensPerPill
        )

        const spawnSpace = eligiblePools.length > 0 && (state.devFastSpawn || Math.random() < 0.25)

        if (spawnSpace) {
          const deposit = eligiblePools[Math.floor(Math.random() * eligiblePools.length)]
          const { currentSessionId, walletAddress } = useGameData.getState()

          if (currentSessionId && walletAddress) {
            // Request a server-issued ticket before spawning. The server validates
            // the session is active, paid, and the spawn cooldown for this pool's
            // mode has elapsed. No ticket = no token appears.
            convex.mutation(api.spaceDeposits.requestSpawnTicket, {
              depositId: deposit._id,
              playerWalletAddress: walletAddress,
              gameSessionId: currentSessionId as any,
            })
              .then((result) => {
                if (!result.spawnId) return
                const token = new Token({
                  screen: get().screen,
                  type: 'space',
                  color: getTokenColor(deposit.mintAddress),
                  metadata: {
                    symbol: deposit.symbol,
                    value: deposit.tokensPerPill,
                    mineable: true,
                    mintAddress: deposit.mintAddress,
                    spawnId: result.spawnId as string,
                    depositId: deposit._id as string,
                  },
                })
                get().addEntity(token, 'tokens')
              })
              .catch(() => {})
          }
        } else {
          // Standard ASTRDS token — no ticket needed
          const token = new Token({
            screen: state.screen,
            type: 'standard',
            color: ASTRDS_COLOR,
          })
          state.addEntity(token, 'tokens')
        }
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
