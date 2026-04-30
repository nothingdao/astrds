import { describe, expect, it, vi } from "vitest";

vi.mock("./emissionTiers.js", () => ({
  fetchEmissionTier: vi.fn(async () => ({
    tier: 2,
    pillsPerGame: 10,
    astrdsPerPill: 5,
  })),
  getFallbackEmissionTier: vi.fn(() => ({
    tier: 2,
    pillsPerGame: 10,
    astrdsPerPill: 5,
  })),
}));

import { GameRuntime } from "./GameRuntime.js";
import { DEFAULT_GAME_CONFIG } from "./gameConfig.js";
import type { ConvexServerClient } from "../convex/client.js";
import type { SpaceTokenPool } from "../../../shared/game/protocol.js";

function createConvexStub(overrides: Partial<ConvexServerClient> = {}) {
  const stub = {
    isVerifiedSession: vi.fn(async () => true),
    consumeSession: vi.fn(async () => true),
    getGameConfig: vi.fn(async () => DEFAULT_GAME_CONFIG),
    getActivePoolsForLevel: vi.fn(async () => [] as SpaceTokenPool[]),
    incrementPillsCollected: vi.fn(async () => undefined),
    collectFromDeposit: vi.fn(async () => undefined),
    requestSpawnTicket: vi.fn(async () => ({ spawnId: null })),
    updateGameSession: vi.fn(async () => undefined),
    setAstrdsEarned: vi.fn(async () => undefined),
    ...overrides,
  };
  return stub as unknown as ConvexServerClient & typeof stub;
}

describe("GameRuntime", () => {
  it("rejects hello without a wallet", async () => {
    const convex = createConvexStub();
    const runtime = new GameRuntime("runtime-test", convex);

    const result = await runtime.handleHello({
      screen: { width: 800, height: 600 },
      session: {},
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe("No active session. Please insert a quarter.");
    expect(runtime.ready).toBe(false);
    expect(convex.isVerifiedSession).not.toHaveBeenCalled();
  });

  it("rejects hello when the paid session is not verified", async () => {
    const convex = createConvexStub({
      isVerifiedSession: vi.fn(async () => false),
    });
    const runtime = new GameRuntime("runtime-test", convex);

    const result = await runtime.handleHello({
      screen: { width: 800, height: 600 },
      session: { walletAddress: "wallet-1", gameSessionId: "game-1" },
    });

    expect(result.ok).toBe(false);
    expect(runtime.ready).toBe(false);
    expect(convex.isVerifiedSession).toHaveBeenCalledWith({
      walletAddress: "wallet-1",
    });
    expect(convex.consumeSession).not.toHaveBeenCalled();
  });

  it("consumes a verified session and returns an initialized snapshot", async () => {
    const convex = createConvexStub();
    const runtime = new GameRuntime("runtime-test", convex);

    const result = await runtime.handleHello({
      screen: { width: 800, height: 600 },
      session: { walletAddress: "wallet-1", gameSessionId: "game-1" },
    });

    expect(result.ok).toBe(true);
    expect(runtime.ready).toBe(true);
    expect(result.snapshot?.screen).toEqual({ width: 800, height: 600 });
    expect(result.snapshot?.status).toBe("playing");
    expect(convex.isVerifiedSession).toHaveBeenCalledWith({
      walletAddress: "wallet-1",
    });
    expect(convex.consumeSession).toHaveBeenCalledWith({
      walletAddress: "wallet-1",
    });
    expect(convex.getGameConfig).toHaveBeenCalled();
    expect(convex.getActivePoolsForLevel).toHaveBeenCalledWith({ level: 1 });
  });

  it("is idempotent after hello and does not consume the paid session twice", async () => {
    const convex = createConvexStub();
    const runtime = new GameRuntime("runtime-test", convex);

    await runtime.handleHello({
      screen: { width: 800, height: 600 },
      session: { walletAddress: "wallet-1", gameSessionId: "game-1" },
    });
    const second = await runtime.handleHello({
      screen: { width: 1024, height: 768 },
      session: { walletAddress: "wallet-1", gameSessionId: "game-1" },
    });

    expect(second.ok).toBe(true);
    expect(second.snapshot?.screen).toEqual({ width: 1024, height: 768 });
    expect(convex.consumeSession).toHaveBeenCalledTimes(1);
  });

  it("ticks the simulation and returns a snapshot", async () => {
    const runtime = new GameRuntime("runtime-test", createConvexStub());
    await runtime.handleHello({
      screen: { width: 800, height: 600 },
      session: { walletAddress: "wallet-1", gameSessionId: "game-1" },
    });

    runtime.mergeInput({ up: true });
    const { snapshot } = runtime.tick(1, Date.now());

    expect(snapshot.sessionId).toBe("runtime-test");
    expect(snapshot.tick).toBeGreaterThan(0);
    expect(snapshot.status).toBe("playing");
  });
});
