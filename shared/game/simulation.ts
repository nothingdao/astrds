import type {
  AsteroidSnapshot,
  BulletSnapshot,
  GameSnapshot,
  InputState,
  PickupKind,
  PickupSnapshot,
  ScreenBounds,
  ShipSnapshot,
  Vector2D,
} from './protocol'

const SHIP_RADIUS = 20
const SHIP_ROTATION_SPEED = 6
const SHIP_ACCELERATION = 0.25
const SHIP_INERTIA = 0.99
const SHIP_INVULNERABILITY_MS = 3000
const POWERUP_DURATION_MS = 10_000
const MAX_LIVES = 5
const PILL_SPAWN_DELAY_MS = 3000
const TOKEN_SPAWN_DELAY_MS = 5000
const SHIP_PICKUP_DELAY_MS = 20_000

interface MutableShip extends ShipSnapshot {
  invulnerableUntil: number
  lastShotAt: number
}

interface MutableAsteroid extends AsteroidSnapshot {}

interface MutableBullet extends BulletSnapshot {
  lifeSpan: number
  createdAt: number
}

interface MutablePickup extends PickupSnapshot {
  expiresAt: number
}

export interface SimulationState {
  sessionId: string
  tick: number
  status: 'playing' | 'gameOver'
  screen: ScreenBounds
  input: InputState
  score: number
  level: number
  lives: number
  pillsCollected: number
  tokensCollected: number
  asteroidCount: number
  ship: MutableShip | null
  asteroids: MutableAsteroid[]
  bullets: MutableBullet[]
  pills: MutablePickup[]
  tokens: MutablePickup[]
  shipPickups: MutablePickup[]
  powerups: {
    invincible: boolean
    rapidFire: boolean
    expiresAt: number | null
  }
  lastPillSpawnAt: number
  lastTokenSpawnAt: number
  lastShipPickupSpawnAt: number
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function randomNumBetween(min: number, max: number): number {
  return Math.random() * (max - min + 1) + min
}

function asteroidVertices(count: number, radius: number): Vector2D[] {
  const vertices: Vector2D[] = []
  for (let i = 0; i < count; i += 1) {
    vertices.push({
      x:
        (-Math.sin(((360 / count) * i * Math.PI) / 180) +
          (Math.round(Math.random() * 2 - 1) * Math.random()) / 3) *
        radius,
      y:
        (-Math.cos(((360 / count) * i * Math.PI) / 180) +
          (Math.round(Math.random() * 2 - 1) * Math.random()) / 3) *
        radius,
    })
  }
  return vertices
}

function rotatePoint(point: Vector2D, center: Vector2D, angle: number): Vector2D {
  return {
    x:
      (point.x - center.x) * Math.cos(angle) -
      (point.y - center.y) * Math.sin(angle) +
      center.x,
    y:
      (point.x - center.x) * Math.sin(angle) +
      (point.y - center.y) * Math.cos(angle) +
      center.y,
  }
}

function wrapPosition(position: Vector2D, screen: ScreenBounds, radius = 0): void {
  if (position.x > screen.width + radius) position.x = -radius
  else if (position.x < -radius) position.x = screen.width + radius

  if (position.y > screen.height + radius) position.y = -radius
  else if (position.y < -radius) position.y = screen.height + radius
}

export function checkCollision(
  a: { position: Vector2D; radius: number },
  b: { position: Vector2D; radius: number }
): boolean {
  const dx = a.position.x - b.position.x
  const dy = a.position.y - b.position.y
  return Math.sqrt(dx * dx + dy * dy) < a.radius + b.radius
}

function createShip(screen: ScreenBounds, now: number): MutableShip {
  return {
    id: createId('ship'),
    position: { x: screen.width / 2, y: screen.height / 2 },
    velocity: { x: 0, y: 0 },
    rotation: 0,
    radius: SHIP_RADIUS,
    isInvulnerable: false,
    invulnerableUntil: 0,
    lastShotAt: 0,
  }
}

function createAsteroid(position: Vector2D, size: number): MutableAsteroid {
  return {
    id: createId('asteroid'),
    position: { ...position },
    velocity: {
      x: randomNumBetween(-1.5, 1.5),
      y: randomNumBetween(-1.5, 1.5),
    },
    rotation: 0,
    radius: size,
    score: Math.floor((80 / Math.max(1, size)) * 5),
    vertices: asteroidVertices(8, size),
  }
}

function createBullet(ship: MutableShip, rapidFire: boolean, now: number): MutableBullet {
  const speed = rapidFire ? 20 : 15
  const power = rapidFire ? 2 : 1
  const radius = rapidFire ? 1.5 : 2
  const lifeSpan = rapidFire ? 25 : 35
  const color = '#fff'
  const posDelta = rotatePoint(
    { x: 0, y: -20 },
    { x: 0, y: 0 },
    (ship.rotation * Math.PI) / 180
  )

  return {
    id: createId('bullet'),
    position: {
      x: ship.position.x + posDelta.x,
      y: ship.position.y + posDelta.y,
    },
    velocity: {
      x: ((posDelta.x / 2) * speed) / 10,
      y: ((posDelta.y / 2) * speed) / 10,
    },
    rotation: ship.rotation,
    radius,
    power,
    color,
    lifeSpan,
    createdAt: now,
  }
}

function createEdgePickup(
  kind: PickupKind,
  screen: ScreenBounds,
  color: string,
  now: number
): MutablePickup {
  const radius = kind === 'shipPickup' ? 20 : 8
  const edge = Math.floor(Math.random() * 4)
  let position: Vector2D = { x: 0, y: 0 }

  switch (edge) {
    case 0:
      position = { x: Math.random() * screen.width, y: -radius }
      break
    case 1:
      position = { x: screen.width + radius, y: Math.random() * screen.height }
      break
    case 2:
      position = { x: Math.random() * screen.width, y: screen.height + radius }
      break
    default:
      position = { x: -radius, y: Math.random() * screen.height }
      break
  }

  return {
    id: createId(kind),
    kind,
    position,
    velocity:
      kind === 'shipPickup'
        ? { x: 0, y: 0 }
        : { x: randomNumBetween(-1.5, 1.5), y: randomNumBetween(-1.5, 1.5) },
    rotation: 0,
    radius,
    color,
    expiresAt: now + 15_000,
  }
}

function spawnAsteroids(screen: ScreenBounds, count: number, ship: MutableShip): MutableAsteroid[] {
  const asteroids: MutableAsteroid[] = []
  while (asteroids.length < count) {
    const x = randomNumBetween(0, screen.width)
    const y = randomNumBetween(0, screen.height)
    if (Math.abs(x - ship.position.x) < 100 && Math.abs(y - ship.position.y) < 100) {
      continue
    }
    asteroids.push(createAsteroid({ x, y }, 40))
  }
  return asteroids
}

export function createInitialSimulationState(
  sessionId: string,
  screen: ScreenBounds,
  now = Date.now()
): SimulationState {
  const ship = createShip(screen, now)
  const asteroidCount = 2

  return {
    sessionId,
    tick: 0,
    status: 'playing',
    screen: { ...screen },
    input: { left: false, right: false, up: false, space: false },
    score: 0,
    level: 1,
    lives: 3,
    pillsCollected: 0,
    tokensCollected: 0,
    asteroidCount,
    ship,
    asteroids: spawnAsteroids(screen, asteroidCount, ship),
    bullets: [],
    pills: [],
    tokens: [],
    shipPickups: [],
    powerups: {
      invincible: false,
      rapidFire: false,
      expiresAt: null,
    },
    lastPillSpawnAt: now,
    lastTokenSpawnAt: now,
    lastShipPickupSpawnAt: now,
  }
}

function updatePowerups(state: SimulationState, now: number): void {
  if (state.powerups.expiresAt && now >= state.powerups.expiresAt) {
    state.powerups = { invincible: false, rapidFire: false, expiresAt: null }
  }
}

function updateShip(state: SimulationState, dt: number, now: number): void {
  const ship = state.ship
  if (!ship) return

  if (ship.invulnerableUntil > now) {
    ship.isInvulnerable = true
  } else {
    ship.isInvulnerable = false
  }

  if (state.input.left) ship.rotation -= SHIP_ROTATION_SPEED * dt
  if (state.input.right) ship.rotation += SHIP_ROTATION_SPEED * dt
  if (state.input.up) {
    ship.velocity.x -= Math.sin((-ship.rotation * Math.PI) / 180) * SHIP_ACCELERATION * dt
    ship.velocity.y -= Math.cos((-ship.rotation * Math.PI) / 180) * SHIP_ACCELERATION * dt
  }

  ship.position.x += ship.velocity.x * dt
  ship.position.y += ship.velocity.y * dt
  ship.velocity.x *= SHIP_INERTIA
  ship.velocity.y *= SHIP_INERTIA

  if (ship.rotation >= 360) ship.rotation -= 360
  if (ship.rotation < 0) ship.rotation += 360

  if (ship.position.x > state.screen.width) ship.position.x = 0
  else if (ship.position.x < 0) ship.position.x = state.screen.width
  if (ship.position.y > state.screen.height) ship.position.y = 0
  else if (ship.position.y < 0) ship.position.y = state.screen.height
}

function maybeShootBullet(state: SimulationState, now: number): void {
  const ship = state.ship
  if (!ship || !state.input.space) return

  const shootDelay = state.powerups.rapidFire ? 50 : 250
  if (now - ship.lastShotAt < shootDelay) return

  ship.lastShotAt = now
  state.bullets.push(createBullet(ship, state.powerups.rapidFire, now))
}

function updateAsteroids(state: SimulationState, dt: number): void {
  state.asteroids.forEach((asteroid) => {
    asteroid.position.x += asteroid.velocity.x * dt
    asteroid.position.y += asteroid.velocity.y * dt
    asteroid.rotation += randomNumBetween(-1, 1) * dt
    if (asteroid.rotation >= 360) asteroid.rotation -= 360
    if (asteroid.rotation < 0) asteroid.rotation += 360
    wrapPosition(asteroid.position, state.screen, asteroid.radius)
  })
}

function updateBullets(state: SimulationState, dt: number, now: number): void {
  state.bullets = state.bullets.filter((bullet) => {
    if (now - bullet.createdAt > 1000) return false
    bullet.position.x += bullet.velocity.x * dt
    bullet.position.y += bullet.velocity.y * dt
    bullet.lifeSpan -= dt
    if (bullet.lifeSpan <= 0) return false
    if (
      bullet.position.x < 0 ||
      bullet.position.y < 0 ||
      bullet.position.x > state.screen.width ||
      bullet.position.y > state.screen.height
    ) {
      return false
    }
    return true
  })
}

function updatePickups(pickups: MutablePickup[], screen: ScreenBounds, dt: number, now: number): MutablePickup[] {
  return pickups.filter((pickup) => {
    pickup.position.x += pickup.velocity.x * dt
    pickup.position.y += pickup.velocity.y * dt
    wrapPosition(pickup.position, screen, pickup.radius)
    return pickup.expiresAt > now
  })
}

function resolveBulletAsteroidCollisions(state: SimulationState): void {
  const nextBullets: MutableBullet[] = []
  const destroyedAsteroids = new Set<string>()

  state.bullets.forEach((bullet) => {
    let hit = false

    state.asteroids.forEach((asteroid) => {
      if (hit || destroyedAsteroids.has(asteroid.id)) return
      if (!checkCollision(bullet, asteroid)) return

      hit = true
      destroyedAsteroids.add(asteroid.id)
      state.score += Math.max(0, Math.floor(asteroid.score))

      if (asteroid.radius > 10) {
        state.asteroids.push(
          createAsteroid(
            {
              x: asteroid.position.x + randomNumBetween(-10, 20),
              y: asteroid.position.y + randomNumBetween(-10, 20),
            },
            asteroid.radius / 2
          ),
          createAsteroid(
            {
              x: asteroid.position.x + randomNumBetween(-10, 20),
              y: asteroid.position.y + randomNumBetween(-10, 20),
            },
            asteroid.radius / 2
          )
        )
      }
    })

    if (!hit) nextBullets.push(bullet)
  })

  state.bullets = nextBullets
  state.asteroids = state.asteroids.filter((asteroid) => !destroyedAsteroids.has(asteroid.id))
}

function resolveShipPickupCollision(
  state: SimulationState,
  pickups: MutablePickup[],
  onCollect: () => void
): MutablePickup[] {
  if (!state.ship) return pickups

  return pickups.filter((pickup) => {
    if (checkCollision(state.ship!, pickup)) {
      onCollect()
      return false
    }
    return true
  })
}

function handleShipAsteroidCollisions(state: SimulationState, now: number): void {
  if (!state.ship) return

  const remainingAsteroids: MutableAsteroid[] = []
  let collided = false

  state.asteroids.forEach((asteroid) => {
    if (checkCollision(state.ship!, asteroid)) {
      collided = true
      return
    }
    remainingAsteroids.push(asteroid)
  })

  if (!collided) return

  state.asteroids = remainingAsteroids

  if (state.ship.isInvulnerable || state.powerups.invincible) {
    return
  }

  state.lives -= 1
  if (state.lives <= 0) {
    state.lives = 0
    state.ship = null
    state.status = 'gameOver'
    return
  }

  state.ship = {
    ...createShip(state.screen, now),
    id: state.ship.id,
    isInvulnerable: true,
    invulnerableUntil: now + SHIP_INVULNERABILITY_MS,
    lastShotAt: state.ship.lastShotAt,
  }
}

function maybeAdvanceLevel(state: SimulationState): void {
  if (state.asteroids.length > 0 || !state.ship) return

  state.level += 1
  state.asteroidCount = Math.min(state.asteroidCount + 1, 10)
  state.bullets = []
  state.pills = []
  state.tokens = []
  state.shipPickups = []
  state.asteroids = spawnAsteroids(state.screen, state.asteroidCount, state.ship)
}

function maybeSpawnPickups(state: SimulationState, now: number): void {
  if (now - state.lastPillSpawnAt >= PILL_SPAWN_DELAY_MS) {
    state.pills.push(createEdgePickup('pill', state.screen, '#4dc1f9', now))
    state.lastPillSpawnAt = now
  }

  if (now - state.lastTokenSpawnAt >= TOKEN_SPAWN_DELAY_MS) {
    state.tokens.push(createEdgePickup('token', state.screen, '#FF642D', now))
    state.lastTokenSpawnAt = now
  }

  if (
    state.shipPickups.length === 0 &&
    now - state.lastShipPickupSpawnAt >= SHIP_PICKUP_DELAY_MS
  ) {
    state.shipPickups.push(createEdgePickup('shipPickup', state.screen, '#87CEEB', now))
    state.lastShipPickupSpawnAt = now
  }
}

export function updateSimulation(state: SimulationState, dt: number, now = Date.now()): void {
  if (state.status === 'gameOver') return

  state.tick += 1
  updatePowerups(state, now)
  updateShip(state, dt, now)
  updateAsteroids(state, dt)
  updateBullets(state, dt, now)
  state.pills = updatePickups(state.pills, state.screen, dt, now)
  state.tokens = updatePickups(state.tokens, state.screen, dt, now)
  state.shipPickups = updatePickups(state.shipPickups, state.screen, dt, now)

  maybeShootBullet(state, now)
  resolveBulletAsteroidCollisions(state)

  state.pills = resolveShipPickupCollision(state, state.pills, () => {
    state.pillsCollected += 1
    state.powerups = {
      invincible: true,
      rapidFire: true,
      expiresAt: now + POWERUP_DURATION_MS,
    }
  })

  state.tokens = resolveShipPickupCollision(state, state.tokens, () => {
    state.tokensCollected += 1
  })

  state.shipPickups = resolveShipPickupCollision(state, state.shipPickups, () => {
    state.lives = Math.min(MAX_LIVES, state.lives + 1)
  })

  handleShipAsteroidCollisions(state, now)
  maybeAdvanceLevel(state)
  maybeSpawnPickups(state, now)
}

export function resizeSimulation(state: SimulationState, screen: ScreenBounds): void {
  state.screen = { ...screen }
  if (state.ship) {
    state.ship.position.x = Math.min(state.ship.position.x, screen.width)
    state.ship.position.y = Math.min(state.ship.position.y, screen.height)
  }
}

export function simulationToSnapshot(state: SimulationState): GameSnapshot {
  return {
    sessionId: state.sessionId,
    tick: state.tick,
    status: state.status,
    screen: { ...state.screen },
    score: state.score,
    level: state.level,
    lives: state.lives,
    pillsCollected: state.pillsCollected,
    tokensCollected: state.tokensCollected,
    ship: state.ship
      ? {
          id: state.ship.id,
          position: { ...state.ship.position },
          velocity: { ...state.ship.velocity },
          rotation: state.ship.rotation,
          radius: state.ship.radius,
          isInvulnerable: state.ship.isInvulnerable,
        }
      : null,
    asteroids: state.asteroids.map((asteroid) => ({
      id: asteroid.id,
      position: { ...asteroid.position },
      velocity: { ...asteroid.velocity },
      rotation: asteroid.rotation,
      radius: asteroid.radius,
      score: asteroid.score,
      vertices: asteroid.vertices.map((vertex) => ({ ...vertex })),
    })),
    bullets: state.bullets.map((bullet) => ({
      id: bullet.id,
      position: { ...bullet.position },
      velocity: { ...bullet.velocity },
      rotation: bullet.rotation,
      radius: bullet.radius,
      power: bullet.power,
      color: bullet.color,
    })),
    pills: state.pills.map((pickup) => ({
      id: pickup.id,
      kind: pickup.kind,
      position: { ...pickup.position },
      velocity: { ...pickup.velocity },
      rotation: pickup.rotation,
      radius: pickup.radius,
      color: pickup.color,
    })),
    tokens: state.tokens.map((pickup) => ({
      id: pickup.id,
      kind: pickup.kind,
      position: { ...pickup.position },
      velocity: { ...pickup.velocity },
      rotation: pickup.rotation,
      radius: pickup.radius,
      color: pickup.color,
    })),
    shipPickups: state.shipPickups.map((pickup) => ({
      id: pickup.id,
      kind: pickup.kind,
      position: { ...pickup.position },
      velocity: { ...pickup.velocity },
      rotation: pickup.rotation,
      radius: pickup.radius,
      color: pickup.color,
    })),
    powerups: { ...state.powerups },
  }
}
