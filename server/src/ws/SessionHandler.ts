import { WebSocket } from 'ws'
import { GameSession } from '../game/GameSession.js'
import type {
  ClientToServerMessage,
  GameSnapshot,
  ServerToClientMessage,
} from '../../../shared/game/protocol.js'

const TICK_RATE = 30
const FRAME_MS = 1000 / TICK_RATE

export class SessionHandler {
  private readonly socket: WebSocket
  private readonly session: GameSession
  private loop: NodeJS.Timeout | null = null
  private lastTickAt = Date.now()

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
      const snapshot = this.session.update(dt, now)
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

  handle(raw: string): void {
    let message: ClientToServerMessage
    try {
      message = JSON.parse(raw) as ClientToServerMessage
    } catch {
      this.send({ type: 'error', message: 'Invalid JSON payload' })
      return
    }

    switch (message.type) {
      case 'hello':
      case 'resize': {
        const snapshot = this.session.resize(message.screen)
        this.send({ type: 'state', snapshot })
        return
      }
      case 'input':
        this.session.mergeInput(message.input)
        return
      case 'reset': {
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
}
