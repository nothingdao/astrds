import { WebSocket } from "ws";
import { GameRuntime } from "../game/GameRuntime.js";
import type {
  ClientToServerMessage,
  GameSnapshot,
  ServerToClientMessage,
} from "../../../shared/game/protocol.js";

const TICK_RATE = 30;
const FRAME_MS = 1000 / TICK_RATE;

export class SessionHandler {
  private readonly socket: WebSocket;
  private readonly runtime: GameRuntime;
  private loop: NodeJS.Timeout | null = null;
  private lastTickAt = Date.now();

  constructor(socket: WebSocket, sessionId: string) {
    this.socket = socket;
    this.runtime = new GameRuntime(sessionId);
  }

  start(): void {
    this.send({
      type: "welcome",
      sessionId: this.runtime.id,
      snapshot: this.runtime.snapshot(),
    });
  }

  stop(): void {
    if (this.loop) {
      clearInterval(this.loop);
      this.loop = null;
    }
  }

  pause(): void {
    this.stop();
  }

  resume(): void {
    if (!this.runtime.ready) return;
    if (this.loop) return;
    this.lastTickAt = Date.now();
    this.loop = setInterval(() => {
      const now = Date.now();
      const dt = Math.min((now - this.lastTickAt) / (1000 / 60), 2);
      this.lastTickAt = now;
      const { snapshot } = this.runtime.tick(dt, now);
      this.send({
        type: snapshot.status === "gameOver" ? "gameOver" : "state",
        snapshot,
      });
    }, FRAME_MS);
  }

  handle(raw: string): void {
    let message: ClientToServerMessage;
    try {
      message = JSON.parse(raw) as ClientToServerMessage;
    } catch {
      this.send({ type: "error", message: "Invalid JSON payload" });
      return;
    }

    switch (message.type) {
      case "hello": {
        void this.handleHello(message);
        return;
      }
      case "resize": {
        this.send({
          type: "state",
          snapshot: this.runtime.resize(message.screen),
        });
        return;
      }
      case "input":
        this.runtime.mergeInput(message.input);
        return;
      case "pause":
        this.pause();
        return;
      case "resume":
        this.resume();
        return;
      case "reset":
        this.send({ type: "state", snapshot: this.runtime.reset() });
        return;
      case "ping":
        this.send({ type: "pong", at: message.at });
        return;
      default:
        this.send({ type: "error", message: "Unsupported message type" });
    }
  }

  private send(
    message: ServerToClientMessage & { snapshot?: GameSnapshot }
  ): void {
    if (this.socket.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify(message));
  }

  private async handleHello(
    message: Extract<ClientToServerMessage, { type: "hello" }>
  ): Promise<void> {
    const result = await this.runtime.handleHello({
      screen: message.screen,
      session: message.session,
    });

    if (!result.ok) {
      this.send({
        type: "error",
        message: result.error ?? "No active session. Please insert a quarter.",
      });
      this.socket.close();
      return;
    }

    if (result.snapshot) {
      this.send({ type: "state", snapshot: result.snapshot });
    }
    this.resume();
  }
}
