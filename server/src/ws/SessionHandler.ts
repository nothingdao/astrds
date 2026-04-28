import { WebSocket } from 'ws'
import { GameSession } from '../game/GameSession.js'
import { fetchEmissionTier, getFallbackEmissionTier } from '../game/emissionTiers.js'
import { DEFAULT_GAME_CONFIG, type GameConfig } from '../game/gameConfig.js'
import { ConvexServerClient } from '../convex/client.js'
import type {
  AuthorizedSpaceTokenSpawn,
  ClientToServerMessage,
  GameSnapshot,
  SessionBinding,
  SimulationEvent,
  SpaceTokenPool,
  ServerToClientMessage,
} from '../../../shared/game/protocol.js'

const TICK_RATE = 30
const FRAME_MS = 1000 / TICK_RATE
const POOL_REFRESH_MS = 10_000

export class SessionHandler {
  private readonly socket: WebSocket
  private readonly session: GameSession
  private readonly convex = new ConvexServerClient()
  private loop: NodeJS.Timeout | null = null
  private lastTickAt = Date.now()
  private binding: SessionBinding = {}
  private didSubmitGameOver = false
  private activeSpaceTokenPools: SpaceTokenPool[] = []
  private lastPoolRefreshAt = 0
  private lastPoolLevel = 1
  private refreshingPools: Promise<void> | null = null
  private gameConfig: GameConfig = DEFAULT_GAME_CONFIG
  private lastConfigRefreshAt = 0
  private refreshingConfig: Promise<void> | null = null
  private helloHandled = false
  private helloVerifying = false

  constructor(socket: WebSocket, sessionId: string) {
    this.socket = socket
    this.session = new GameSession(sessionId)
  }

  start(): void {
    this.send({ type: 'welcome', sessionId: this.session.id, snapshot: this.session.snapshot() })
  }

  stop(): void {
    if (this.loop) {
      clearInterval(this.loop)
      this.loop = null
    }
  }

  pause(): void {
    if (this.loop) {
      clearInterval(this.loop)
      this.loop = null
    }
  }

  resume(): void {
    if (!this.helloHandled) return
    if (this.loop) return
    this.lastTickAt = Date.now()
    this.loop = setInterval(() => {
      const now = Date.now()
      const dt = Math.min((now - this.lastTickAt) / (1000 / 60), 2)
      this.lastTickAt = now
      const { snapshot, events } = this.session.update(dt, now)
      this.handleSimulationEvents(events, now)
      this.maybeSubmitGameOver(snapshot)
      this.maybeRefreshSpaceTokenPools(now, snapshot.level)
      this.maybeRefreshGameConfig(now)
      this.send({
        type: snapshot.status === 'gameOver' ? 'gameOver' : 'state',
        snapshot,
      })
    }, FRAME_MS)
  }

  handle(raw: string): void {
    let message: ClientToServerMessage
    try {
      message = JSON.parse(raw) as ClientToServerMessage
    } catch {
      this.send({ type: 'error', message: 'Invalid JSON payload' })
      return
    }

    switch (message.type) {
      case 'hello': {
        void this.handleHello(message)
        return
      }
      case 'resize': {
        const snapshot = this.session.resize(message.screen)
        this.send({ type: 'state', snapshot })
        return
      }
      case 'input':
        this.session.mergeInput(message.input)
        return
      case 'pause':
        this.pause()
        return
      case 'resume':
        this.resume()
        return
      case 'reset': {
        this.didSubmitGameOver = false
        const snapshot = this.session.reset()
        this.session.setSpaceTokenPools(this.activeSpaceTokenPools)
        this.session.applyConfig(this.gameConfig)
        this.refreshSpaceTokenPools(this.session.level)
        this.send({ type: 'state', snapshot })
        return
      }
      case 'ping':
        this.send({ type: 'pong', at: message.at })
        return
      default:
        this.send({ type: 'error', message: 'Unsupported message type' })
    }
  }

  private send(message: ServerToClientMessage & { snapshot?: GameSnapshot }): void {
    if (this.socket.readyState !== WebSocket.OPEN) return
    this.socket.send(JSON.stringify(message))
  }

  private async handleHello(message: Extract<ClientToServerMessage, { type: 'hello' }>): Promise<void> {
    if (this.helloHandled || this.helloVerifying) {
      const snapshot = this.session.resize(message.screen)
      this.send({ type: 'state', snapshot })
      return
    }

    const walletAddress = message.session?.walletAddress
    if (!walletAddress) {
      this.send({ type: 'error', message: 'No active session. Please insert a quarter.' })
      this.socket.close()
      return
    }

    this.helloVerifying = true
    let isVerified = false

    try {
      isVerified = await this.convex.isVerifiedSession({ walletAddress })
      if (isVerified) {
        isVerified = await this.convex.consumeSession({ walletAddress })
      }
    } catch (error) {
      console.error('Session verification failed; rejecting connection', {
        error,
        sessionId: this.session.id,
        walletAddress,
      })
    } finally {
      this.helloVerifying = false
    }

    if (!isVerified) {
      this.send({ type: 'error', message: 'No active session. Please insert a quarter.' })
      this.socket.close()
      return
    }

    this.helloHandled = true
    this.binding = { ...message.session, walletAddress }
    void fetchEmissionTier(this.gameConfig)
      .then((tier) => {
        this.session.setEmissionTier(tier)
      })
      .catch((error) => {
        console.error('Failed to fetch emission tier; falling back to tier 2', {
          error,
          sessionId: this.session.id,
        })
        this.session.setEmissionTier(getFallbackEmissionTier(this.gameConfig))
      })

    this.refreshGameConfig()
    this.refreshSpaceTokenPools(this.session.level)
    const snapshot = this.session.resize(message.screen)
    this.send({ type: 'state', snapshot })
    this.resume()
  }

  private handleSimulationEvents(events: SimulationEvent[], now: number): void {
    for (const event of events) {
      if (event.type === 'pillCollected') {
        this.incrementPillsCollected()
        continue
      }

      if (event.type === 'spaceTokenSpawnRequested') {
        this.requestSpaceTokenSpawn(event.pool, now)
        continue
      }

      if (event.type === 'tokenCollected') {
        if (event.source !== 'space' || !event.spawnId) continue
        const { walletAddress, gameSessionId } = this.binding
        if (!walletAddress || !gameSessionId) continue

        void this.convex
          .collectFromDeposit({
            spawnId: event.spawnId,
            playerWalletAddress: walletAddress,
            gameSessionId,
          })
          .catch((error) => {
            console.error('Failed to record space-token collection', {
              error,
              sessionId: this.session.id,
              convexSessionId: gameSessionId,
              spawnId: event.spawnId,
            })
          })
        continue
      }
    }
  }

  private maybeRefreshGameConfig(now: number): void {
    if (this.refreshingConfig) return
    if (now - this.lastConfigRefreshAt >= POOL_REFRESH_MS) {
      this.refreshGameConfig()
    }
  }

  private refreshGameConfig(): void {
    this.refreshingConfig = this.convex
      .getGameConfig()
      .then((config) => {
        const prevVersion = this.gameConfig.version
        this.gameConfig = config
        this.lastConfigRefreshAt = Date.now()

        if (config.version !== prevVersion && config.applyToRunning) {
          this.session.applyConfig(config)
        }
      })
      .catch((error) => {
        console.error('Failed to refresh game config', {
          error,
          sessionId: this.session.id,
        })
      })
      .finally(() => {
        this.refreshingConfig = null
      })
  }

  private maybeRefreshSpaceTokenPools(now: number, level: number): void {
    if (this.refreshingPools) return
    if (level !== this.lastPoolLevel || now - this.lastPoolRefreshAt >= POOL_REFRESH_MS) {
      this.refreshSpaceTokenPools(level)
    }
  }

  private refreshSpaceTokenPools(level: number): void {
    this.lastPoolLevel = level
    this.refreshingPools = this.convex
      .getActivePoolsForLevel({ level })
      .then((pools) => {
        this.activeSpaceTokenPools = pools
        this.session.setSpaceTokenPools(pools)
        this.lastPoolRefreshAt = Date.now()
      })
      .catch((error) => {
        console.error('Failed to refresh active space-token pools', {
          error,
          sessionId: this.session.id,
          level,
        })
      })
      .finally(() => {
        this.refreshingPools = null
      })
  }

  private requestSpaceTokenSpawn(pool: SpaceTokenPool, now: number): void {
    const { walletAddress, gameSessionId } = this.binding
    if (!walletAddress || !gameSessionId) return

    void this.convex
      .requestSpawnTicket({
        depositId: pool.depositId,
        playerWalletAddress: walletAddress,
        gameSessionId,
      })
      .then(({ spawnId }) => {
        if (!spawnId) return

        const spawn: AuthorizedSpaceTokenSpawn = {
          depositId: pool.depositId,
          mintAddress: pool.mintAddress,
          spawnId,
          color: pool.color,
        }
        this.session.spawnAuthorizedSpaceToken(spawn, now)
      })
      .catch((error) => {
        console.error('Failed to request spawn ticket for space token', {
          error,
          sessionId: this.session.id,
          convexSessionId: gameSessionId,
          depositId: pool.depositId,
        })
      })
  }

  private incrementPillsCollected(): void {
    const { gameSessionId } = this.binding
    if (!gameSessionId) return

    void this.convex.incrementPillsCollected({ sessionId: gameSessionId, amount: 1 }).catch((error) => {
      console.error('Failed to increment pillsCollected', {
        error,
        sessionId: this.session.id,
        convexSessionId: gameSessionId,
      })
    })
  }

  private maybeSubmitGameOver(snapshot: GameSnapshot): void {
    if (snapshot.status !== 'gameOver' || this.didSubmitGameOver) return

    const { gameSessionId } = this.binding
    if (!gameSessionId) return

    this.didSubmitGameOver = true
    const rawPerPill = BigInt(Math.round(snapshot.emissionTier.astrdsPerPill * 1_000_000_000))
    const earnedRaw = BigInt(snapshot.pillsCollected) * rawPerPill
    const astrdsEarned = Number(earnedRaw) / 1_000_000_000
    const astrdsAllocated = 50
    const astrdsBurned = Math.max(0, astrdsAllocated - astrdsEarned)
    void Promise.all([
      this.convex.updateGameSession({
        sessionId: gameSessionId,
        score: snapshot.score,
        levelReached: snapshot.level,
        pillsCollected: snapshot.pillsCollected,
        status: 'ended',
      }),
      this.convex.setAstrdsEarned({
        sessionId: gameSessionId,
        amount: astrdsEarned,
        amountRaw: earnedRaw.toString(),
        allocated: astrdsAllocated,
        burned: astrdsBurned,
      }),
    ]).catch((error) => {
      this.didSubmitGameOver = false
      console.error('Failed to submit authoritative game-over state', {
        error,
        sessionId: this.session.id,
        convexSessionId: gameSessionId,
      })
    })
  }
}
