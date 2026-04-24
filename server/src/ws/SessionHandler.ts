import { WebSocket } from 'ws'
import { GameSession } from '../game/GameSession.js'
import { ConvexServerClient } from '../convex/client.js'
import type {
  ClientToServerMessage,
  GameSnapshot,
  SessionBinding,
  SimulationEvent,
  ServerToClientMessage,
} from '../../../shared/game/protocol.js'

const TICK_RATE = 30
const FRAME_MS = 1000 / TICK_RATE

export class SessionHandler {
  private readonly socket: WebSocket
  private readonly session: GameSession
  private readonly convex = new ConvexServerClient()
  private loop: NodeJS.Timeout | null = null
  private lastTickAt = Date.now()
  private binding: SessionBinding = {}
  private didSubmitGameOver = false

  constructor(socket: WebSocket, sessionId: string) {
    this.socket = socket
    this.session = new GameSession(sessionId)
  }

  start(): void {
    this.send({ type: 'welcome', sessionId: this.session.id, snapshot: this.session.snapshot() })

    this.lastTickAt = Date.now()
    this.loop = setInterval(() => {
      const now = Date.now()
      const dt = Math.min((now - this.lastTickAt) / (1000 / 60), 2)
      this.lastTickAt = now
      const { snapshot, events } = this.session.update(dt, now)
      this.handleSimulationEvents(events)
      this.maybeSubmitGameOver(snapshot)
      this.send({
        type: snapshot.status === 'gameOver' ? 'gameOver' : 'state',
        snapshot,
      })
    }, FRAME_MS)
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
    if (this.loop) return
    this.lastTickAt = Date.now()
    this.loop = setInterval(() => {
      const now = Date.now()
      const dt = Math.min((now - this.lastTickAt) / (1000 / 60), 2)
      this.lastTickAt = now
      const { snapshot, events } = this.session.update(dt, now)
      this.handleSimulationEvents(events)
      this.maybeSubmitGameOver(snapshot)
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
        this.binding = { ...message.session }
        const snapshot = this.session.resize(message.screen)
        this.send({ type: 'state', snapshot })
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

  private handleSimulationEvents(events: SimulationEvent[]): void {
    for (const event of events) {
      if (event.type === 'pillCollected') {
        this.incrementPillsCollected()
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
    void this.convex
      .updateGameSession({
        sessionId: gameSessionId,
        score: snapshot.score,
        levelReached: snapshot.level,
        pillsCollected: snapshot.pillsCollected,
        status: 'ended',
      })
      .catch((error) => {
        this.didSubmitGameOver = false
        console.error('Failed to submit authoritative game-over state', {
          error,
          sessionId: this.session.id,
          convexSessionId: gameSessionId,
        })
      })
  }
}
