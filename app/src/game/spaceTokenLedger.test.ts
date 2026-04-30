import { describe, expect, it } from "vitest";
import {
  canIssueSpawnTicket,
  canPoolSpawnOrCollect,
  canReserveCollection,
  canRevertClaimingCollection,
  canUseSpawnTicket,
  remainingAfterCollection,
  statusForRemaining,
  validateDepositAmounts,
  waveWindowStart,
} from "../../convex/spaceTokenLedger";

describe("spaceTokenLedger", () => {
  it("derives active/depleted pool status from remaining amount", () => {
    expect(statusForRemaining(100, 25)).toBe("active");
    expect(statusForRemaining(24, 25)).toBe("depleted");
  });

  it("validates deposit amounts", () => {
    expect(() =>
      validateDepositAmounts({
        totalAmount: 100,
        remainingAmount: 100,
        tokensPerPill: 10,
      })
    ).not.toThrow();
    expect(() =>
      validateDepositAmounts({
        totalAmount: 100,
        remainingAmount: 101,
        tokensPerPill: 10,
      })
    ).toThrow("Invalid deposit amounts");
    expect(() =>
      validateDepositAmounts({
        totalAmount: 100,
        remainingAmount: 10,
        tokensPerPill: 0,
      })
    ).toThrow("Invalid deposit amounts");
  });

  it("decides when pools can spawn or be collected", () => {
    expect(canPoolSpawnOrCollect(undefined)).toBe(false);
    expect(
      canPoolSpawnOrCollect({
        status: "cancelled",
        remainingAmount: 100,
        tokensPerPill: 10,
      })
    ).toBe(false);
    expect(
      canPoolSpawnOrCollect({
        status: "active",
        remainingAmount: 9,
        tokensPerPill: 10,
      })
    ).toBe(false);
    expect(
      canPoolSpawnOrCollect({
        status: "active",
        remainingAmount: 10,
        tokensPerPill: 10,
      })
    ).toBe(true);
  });

  it("applies collection decrement and next status", () => {
    expect(
      remainingAfterCollection({
        status: "active",
        remainingAmount: 20,
        tokensPerPill: 10,
      })
    ).toEqual({
      remainingAmount: 10,
      status: "active",
    });
    expect(
      remainingAfterCollection({
        status: "active",
        remainingAmount: 10,
        tokensPerPill: 10,
      })
    ).toEqual({
      remainingAmount: 0,
      status: "depleted",
    });
  });

  it("enforces steady and escalating spawn intervals", () => {
    expect(
      canIssueSpawnTicket({
        policy: { spawnMode: "steady", spawnInterval: 30 },
        now: 40_000,
        level: 1,
        lastIssuedAt: 20_000,
      })
    ).toBe(false);
    expect(
      canIssueSpawnTicket({
        policy: { spawnMode: "steady", spawnInterval: 30 },
        now: 51_000,
        level: 1,
        lastIssuedAt: 20_000,
      })
    ).toBe(true);
    expect(
      canIssueSpawnTicket({
        policy: {
          spawnMode: "escalating",
          spawnInterval: 30,
          escalationRate: 1,
        },
        now: 6_000,
        level: 10,
        lastIssuedAt: 0,
      })
    ).toBe(true);
  });

  it("enforces wave size inside the cooldown window", () => {
    const policy = {
      spawnMode: "wave" as const,
      waveSize: 3,
      waveCooldown: 60,
    };
    expect(waveWindowStart(120_000, policy)).toBe(60_000);
    expect(
      canIssueSpawnTicket({
        policy,
        now: 120_000,
        level: 1,
        ticketsInWindow: 2,
      })
    ).toBe(true);
    expect(
      canIssueSpawnTicket({
        policy,
        now: 120_000,
        level: 1,
        ticketsInWindow: 3,
      })
    ).toBe(false);
  });

  it("validates spawn ticket collection ownership and expiry", () => {
    const ticket = {
      used: false,
      expiresAt: 1_000,
      playerWalletAddress: "wallet-1",
      gameSessionId: "game-1",
    };
    expect(
      canUseSpawnTicket(ticket, {
        playerWalletAddress: "wallet-1",
        gameSessionId: "game-1",
        now: 999,
      })
    ).toBe(true);
    expect(
      canUseSpawnTicket(
        { ...ticket, used: true },
        { playerWalletAddress: "wallet-1", gameSessionId: "game-1", now: 999 }
      )
    ).toBe(false);
    expect(
      canUseSpawnTicket(ticket, {
        playerWalletAddress: "wallet-2",
        gameSessionId: "game-1",
        now: 999,
      })
    ).toBe(false);
    expect(
      canUseSpawnTicket(ticket, {
        playerWalletAddress: "wallet-1",
        gameSessionId: "game-1",
        now: 1_001,
      })
    ).toBe(false);
  });

  it("encodes collection claim reservation transitions", () => {
    expect(canReserveCollection("pending")).toBe(true);
    expect(canReserveCollection("claiming")).toBe(false);
    expect(canRevertClaimingCollection("claiming")).toBe(true);
    expect(canRevertClaimingCollection("claimed")).toBe(false);
  });
});
