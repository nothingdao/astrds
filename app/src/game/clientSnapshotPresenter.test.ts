import { describe, expect, it } from "vitest";
import { MachineState } from "@/types/machine";
import {
  ASTRDS_PILL_COLOR,
  COMBO_POWERUP_COLOR,
} from "@shared/game/simulation";
import { buildSnapshotPresentation } from "./clientSnapshotPresenter";
import type { GameSnapshot, PickupSnapshot } from "@shared/game/protocol";
import type { SpaceDeposit } from "@/stores/spaceTokenStore";
import type { Id } from "../../convex/_generated/dataModel";

const baseSnapshot = (patch: Partial<GameSnapshot> = {}): GameSnapshot => ({
  sessionId: "session-1",
  tick: 1,
  status: "playing",
  screen: { width: 1280, height: 720 },
  score: 0,
  level: 1,
  lives: 3,
  pillsCollected: 0,
  tokensCollected: 0,
  emissionTier: { tier: 2, pillsPerGame: 10, astrdsPerPill: 5 },
  ship: {
    id: "ship-1",
    position: { x: 100, y: 100 },
    velocity: { x: 0, y: 0 },
    rotation: 0,
    radius: 20,
    isInvulnerable: false,
    isThrusting: false,
  },
  asteroids: [],
  bullets: [],
  pills: [],
  tokens: [],
  shipPickups: [],
  powerupPickups: [],
  powerups: { invincible: false, rapidFire: false, expiresAt: null },
  ...patch,
});

const pickup = (patch: Partial<PickupSnapshot> = {}): PickupSnapshot => ({
  id: "pickup-1",
  kind: "pill",
  position: { x: 50, y: 60 },
  velocity: { x: 0, y: 0 },
  rotation: 0,
  radius: 8,
  color: ASTRDS_PILL_COLOR,
  ...patch,
});

const spaceDeposit = (patch: Partial<SpaceDeposit> = {}): SpaceDeposit => ({
  _id: "deposit-1" as Id<"spaceDeposits">,
  mintAddress: "mint-1",
  programId: "TOKEN_2022",
  symbol: "BONK",
  name: "Bonk",
  decimals: 2,
  totalAmount: 10_000,
  remainingAmount: 9_900,
  tokensPerPill: 125,
  minLevel: 1,
  maxLevel: 10,
  status: "active",
  ...patch,
});

describe("buildSnapshotPresentation", () => {
  it("emits explosion and destroy sound when an asteroid disappears", () => {
    const previous = baseSnapshot({
      asteroids: [
        {
          id: "asteroid-1",
          position: { x: 10, y: 20 },
          velocity: { x: 0, y: 0 },
          rotation: 0,
          radius: 40,
          score: 10,
          vertices: [],
        },
      ],
    });
    const snapshot = baseSnapshot({ asteroids: [] });

    const result = buildSnapshotPresentation({
      previous,
      snapshot,
      activePools: [],
      wasThrusting: false,
    });

    expect(result.explosions).toEqual([
      { position: { x: 10, y: 20 }, radius: 40, count: 15 },
    ]);
    expect(result.sounds).toContain("asteroidDestroyLarge");
  });

  it("emits ASTRDS collection sound and floating text when a pill is collected", () => {
    const previous = baseSnapshot({ pills: [pickup()] });
    const snapshot = baseSnapshot({ pills: [], pillsCollected: 1 });

    const result = buildSnapshotPresentation({
      previous,
      snapshot,
      activePools: [],
      wasThrusting: false,
    });

    expect(result.sounds).toContain("collect");
    expect(result.floatingTexts).toEqual([
      expect.objectContaining({ x: 50, y: 48, text: "+5 ASTRDS" }),
    ]);
    expect(result.storePatch.inventory.astrdsEarned).toBe(5);
  });

  it("records a Space Token pool and formats floating text when a token is collected", () => {
    const token = pickup({
      id: "token-1",
      kind: "token",
      position: { x: 80, y: 90 },
      color: "#a855f7",
      depositId: "deposit-1",
      mintAddress: "mint-1",
    });
    const pool = spaceDeposit();
    const previous = baseSnapshot({ tokens: [token] });
    const snapshot = baseSnapshot({ tokens: [], tokensCollected: 1 });

    const result = buildSnapshotPresentation({
      previous,
      snapshot,
      activePools: [pool],
      wasThrusting: false,
    });

    expect(result.sounds).toContain("spaceTokenCollect");
    expect(result.collectedPools).toEqual([pool]);
    expect(result.floatingTexts).toEqual([
      expect.objectContaining({ x: 80, y: 78, text: "+1.25 BONK" }),
    ]);
  });

  it("emits powerup floating text only when a vanished pickup activates a powerup", () => {
    const previous = baseSnapshot({
      powerupPickups: [
        pickup({
          id: "powerup-1",
          kind: "powerup",
          color: COMBO_POWERUP_COLOR,
        }),
      ],
      powerups: { invincible: false, rapidFire: false, expiresAt: null },
    });
    const snapshot = baseSnapshot({
      powerupPickups: [],
      powerups: { invincible: true, rapidFire: true, expiresAt: 1234 },
    });

    const result = buildSnapshotPresentation({
      previous,
      snapshot,
      activePools: [],
      wasThrusting: false,
    });

    expect(result.floatingTexts).toEqual([
      expect.objectContaining({ text: "SHIELD + RAPID FIRE" }),
    ]);
  });

  it("emits level transition, respawn state, game-over transition, and thrust loop effects", () => {
    const previous = baseSnapshot({
      level: 1,
      ship: {
        ...baseSnapshot().ship!,
        isInvulnerable: false,
        isThrusting: true,
      },
    });
    const snapshot = baseSnapshot({
      status: "gameOver",
      level: 2,
      ship: {
        ...baseSnapshot().ship!,
        isInvulnerable: true,
        isThrusting: false,
      },
    });

    const result = buildSnapshotPresentation({
      previous,
      snapshot,
      activePools: [],
      wasThrusting: true,
    });

    expect(result.levelTransitionTo).toBe(2);
    expect(result.respawning).toBe(true);
    expect(result.machineState).toBe(MachineState.GAME_OVER);
    expect(result.sounds).toContain("thrustStop");
  });
});
