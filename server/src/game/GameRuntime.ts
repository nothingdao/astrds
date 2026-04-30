import { ConvexServerClient } from "../convex/client.js";
import { fetchEmissionTier, getFallbackEmissionTier } from "./emissionTiers.js";
import { DEFAULT_GAME_CONFIG, type GameConfig } from "./gameConfig.js";
import { GameSession } from "./GameSession.js";
import type {
  AuthorizedSpaceTokenSpawn,
  GameSnapshot,
  InputState,
  ScreenBounds,
  SessionBinding,
  SimulationEvent,
  SpaceTokenPool,
} from "../../../shared/game/protocol.js";

const REFRESH_INTERVAL_MS = 10_000;

export interface GameRuntimeHelloResult {
  ok: boolean;
  snapshot?: GameSnapshot;
  error?: string;
}

export interface GameRuntimeTickResult {
  snapshot: GameSnapshot;
}

export class GameRuntime {
  public readonly id: string;

  private readonly session: GameSession;
  private readonly convex: ConvexServerClient;
  private binding: SessionBinding = {};
  private didSubmitGameOver = false;
  private activeSpaceTokenPools: SpaceTokenPool[] = [];
  private lastPoolRefreshAt = 0;
  private lastPoolLevel = 1;
  private refreshingPools: Promise<void> | null = null;
  private gameConfig: GameConfig = DEFAULT_GAME_CONFIG;
  private lastConfigRefreshAt = 0;
  private refreshingConfig: Promise<void> | null = null;
  private helloHandled = false;
  private helloVerifying = false;

  constructor(sessionId: string, convex = new ConvexServerClient()) {
    this.id = sessionId;
    this.session = new GameSession(sessionId);
    this.convex = convex;
  }

  get ready(): boolean {
    return this.helloHandled;
  }

  snapshot(): GameSnapshot {
    return this.session.snapshot();
  }

  resize(screen: ScreenBounds): GameSnapshot {
    return this.session.resize(screen);
  }

  mergeInput(input: Partial<InputState>): void {
    this.session.mergeInput(input);
  }

  reset(): GameSnapshot {
    this.didSubmitGameOver = false;
    this.session.reset();
    this.session.setSpaceTokenPools(this.activeSpaceTokenPools);
    this.session.applyConfig(this.gameConfig);
    this.refreshSpaceTokenPools(this.session.level);
    return this.session.snapshot();
  }

  tick(dt: number, now = Date.now()): GameRuntimeTickResult {
    const { snapshot, events } = this.session.update(dt, now);
    this.handleSimulationEvents(events, now);
    this.maybeSubmitGameOver(snapshot);
    this.maybeRefreshSpaceTokenPools(now, snapshot.level);
    this.maybeRefreshGameConfig(now);
    return { snapshot };
  }

  async handleHello({
    screen,
    session,
  }: {
    screen: ScreenBounds;
    session?: SessionBinding;
  }): Promise<GameRuntimeHelloResult> {
    if (this.helloHandled || this.helloVerifying) {
      return { ok: true, snapshot: this.session.resize(screen) };
    }

    const walletAddress = session?.walletAddress;
    if (!walletAddress) {
      return {
        ok: false,
        error: "No active session. Please insert a quarter.",
      };
    }

    this.helloVerifying = true;
    let isVerified = false;

    try {
      isVerified = await this.convex.isVerifiedSession({ walletAddress });
      if (isVerified) {
        isVerified = await this.convex.consumeSession({ walletAddress });
      }
    } catch (error) {
      console.error("Session verification failed; rejecting connection", {
        error,
        sessionId: this.session.id,
        walletAddress,
      });
    } finally {
      this.helloVerifying = false;
    }

    if (!isVerified) {
      return {
        ok: false,
        error: "No active session. Please insert a quarter.",
      };
    }

    this.helloHandled = true;
    this.binding = { ...session, walletAddress };
    await this.refreshGameConfig();
    this.session.applyConfig(this.gameConfig);
    this.session.reset(screen);

    try {
      this.session.setEmissionTier(await fetchEmissionTier(this.gameConfig));
    } catch (error) {
      console.error("Failed to fetch emission tier; falling back to tier 2", {
        error,
        sessionId: this.session.id,
      });
      this.session.setEmissionTier(getFallbackEmissionTier(this.gameConfig));
    }

    this.refreshSpaceTokenPools(this.session.level);
    return { ok: true, snapshot: this.session.resize(screen) };
  }

  private handleSimulationEvents(events: SimulationEvent[], now: number): void {
    for (const event of events) {
      if (event.type === "pillCollected") {
        this.incrementPillsCollected();
        continue;
      }

      if (event.type === "spaceTokenSpawnRequested") {
        this.requestSpaceTokenSpawn(event.pool, now);
        continue;
      }

      if (event.type === "tokenCollected") {
        if (event.source !== "space" || !event.spawnId) continue;
        const { walletAddress, gameSessionId } = this.binding;
        if (!walletAddress || !gameSessionId) continue;

        void this.convex
          .collectFromDeposit({
            spawnId: event.spawnId,
            playerWalletAddress: walletAddress,
            gameSessionId,
          })
          .catch((error) => {
            console.error("Failed to record space-token collection", {
              error,
              sessionId: this.session.id,
              convexSessionId: gameSessionId,
              spawnId: event.spawnId,
            });
          });
      }
    }
  }

  private maybeRefreshGameConfig(now: number): void {
    if (this.refreshingConfig) return;
    if (now - this.lastConfigRefreshAt >= REFRESH_INTERVAL_MS) {
      this.refreshGameConfig();
    }
  }

  private refreshGameConfig(): Promise<void> {
    if (this.refreshingConfig) return this.refreshingConfig;

    this.refreshingConfig = this.convex
      .getGameConfig()
      .then((config) => {
        const prevVersion = this.gameConfig.version;
        this.gameConfig = config;
        this.lastConfigRefreshAt = Date.now();

        if (config.version !== prevVersion && config.applyToRunning) {
          this.session.applyConfig(config);
        }
      })
      .catch((error) => {
        console.error("Failed to refresh game config", {
          error,
          sessionId: this.session.id,
        });
      })
      .finally(() => {
        this.refreshingConfig = null;
      });
    return this.refreshingConfig;
  }

  private maybeRefreshSpaceTokenPools(now: number, level: number): void {
    if (this.refreshingPools) return;
    if (
      level !== this.lastPoolLevel ||
      now - this.lastPoolRefreshAt >= REFRESH_INTERVAL_MS
    ) {
      this.refreshSpaceTokenPools(level);
    }
  }

  private refreshSpaceTokenPools(level: number): void {
    this.lastPoolLevel = level;
    this.refreshingPools = this.convex
      .getActivePoolsForLevel({ level })
      .then((pools) => {
        this.activeSpaceTokenPools = pools;
        this.session.setSpaceTokenPools(pools);
        this.lastPoolRefreshAt = Date.now();
      })
      .catch((error) => {
        console.error("Failed to refresh active space-token pools", {
          error,
          sessionId: this.session.id,
          level,
        });
      })
      .finally(() => {
        this.refreshingPools = null;
      });
  }

  private requestSpaceTokenSpawn(pool: SpaceTokenPool, now: number): void {
    const { walletAddress, gameSessionId } = this.binding;
    if (!walletAddress || !gameSessionId) return;

    void this.convex
      .requestSpawnTicket({
        depositId: pool.depositId,
        playerWalletAddress: walletAddress,
        gameSessionId,
      })
      .then(({ spawnId }) => {
        if (!spawnId) return;

        const spawn: AuthorizedSpaceTokenSpawn = {
          depositId: pool.depositId,
          mintAddress: pool.mintAddress,
          spawnId,
          color: pool.color,
        };
        this.session.spawnAuthorizedSpaceToken(spawn, now);
      })
      .catch((error) => {
        console.error("Failed to request spawn ticket for space token", {
          error,
          sessionId: this.session.id,
          convexSessionId: gameSessionId,
          depositId: pool.depositId,
        });
      });
  }

  private incrementPillsCollected(): void {
    const { gameSessionId } = this.binding;
    if (!gameSessionId) return;

    void this.convex
      .incrementPillsCollected({ sessionId: gameSessionId, amount: 1 })
      .catch((error) => {
        console.error("Failed to increment pillsCollected", {
          error,
          sessionId: this.session.id,
          convexSessionId: gameSessionId,
        });
      });
  }

  private maybeSubmitGameOver(snapshot: GameSnapshot): void {
    if (snapshot.status !== "gameOver" || this.didSubmitGameOver) return;

    const { gameSessionId } = this.binding;
    if (!gameSessionId) return;

    this.didSubmitGameOver = true;
    const rawPerPill = BigInt(
      Math.round(snapshot.emissionTier.astrdsPerPill * 1_000_000_000)
    );
    const earnedRaw = BigInt(snapshot.pillsCollected) * rawPerPill;
    const astrdsEarned = Number(earnedRaw) / 1_000_000_000;
    const astrdsAllocated = 50;
    const astrdsBurned = Math.max(0, astrdsAllocated - astrdsEarned);
    void Promise.all([
      this.convex.updateGameSession({
        sessionId: gameSessionId,
        score: snapshot.score,
        levelReached: snapshot.level,
        pillsCollected: snapshot.pillsCollected,
        status: "ended",
      }),
      this.convex.setAstrdsEarned({
        sessionId: gameSessionId,
        amount: astrdsEarned,
        amountRaw: earnedRaw.toString(),
        allocated: astrdsAllocated,
        burned: astrdsBurned,
      }),
    ]).catch((error) => {
      this.didSubmitGameOver = false;
      console.error("Failed to submit authoritative game-over state", {
        error,
        sessionId: this.session.id,
        convexSessionId: gameSessionId,
      });
    });
  }
}
