import { MachineState } from "@/types/machine";
import { getAstrdsColor } from "@/lib/tokenColors";
import { resolveCanvasColor, getCanvasTokens } from "@/lib/designTokens";
import {
  COMBO_POWERUP_COLOR,
  SHIELD_PICKUP_COLOR,
} from "@shared/game/simulation";
import type {
  GameSnapshot,
  PickupSnapshot,
  Vector2D,
} from "@shared/game/protocol";
import type { SpaceDeposit } from "@/stores/spaceTokenStore";

export type SnapshotSoundEffect =
  | "asteroidDestroyLarge"
  | "asteroidDestroyMedium"
  | "asteroidDestroySmall"
  | "explosion"
  | "shoot"
  | "collect"
  | "spaceTokenCollect"
  | "thrustStart"
  | "thrustStop";

export interface SnapshotFloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
}

export interface SnapshotExplosion {
  position: Vector2D;
  radius: number;
  count: number;
}

export interface SnapshotStorePatch {
  score: number;
  level: number;
  inventory: {
    items: {
      ships: number;
      tokens: number;
      pills: number;
    };
    astrdsEarned: number;
  };
  powerups: {
    powerups: {
      invincible: boolean;
      rapidFire: boolean;
    };
    powerupExpiresAt: number | null;
  };
}

export interface SnapshotPresentation {
  explosions: SnapshotExplosion[];
  sounds: SnapshotSoundEffect[];
  floatingTexts: SnapshotFloatingText[];
  collectedPools: SpaceDeposit[];
  storePatch: SnapshotStorePatch;
  levelTransitionTo: number | null;
  respawning: boolean | null;
  machineState: MachineState.GAME_OVER | null;
}

interface BuildSnapshotPresentationArgs {
  previous: GameSnapshot | null;
  snapshot: GameSnapshot;
  activePools: SpaceDeposit[];
  wasThrusting: boolean;
}

function asteroidDestroySound(radius: number): SnapshotSoundEffect {
  return radius >= 32
    ? "asteroidDestroyLarge"
    : radius >= 18
    ? "asteroidDestroyMedium"
    : "asteroidDestroySmall";
}

function removedPickups(
  previous: PickupSnapshot[],
  next: PickupSnapshot[]
): PickupSnapshot[] {
  const nextIds = new Set(next.map((pickup) => pickup.id));
  return previous.filter((pickup) => !nextIds.has(pickup.id));
}

function formatSpaceTokenAmount(pool: SpaceDeposit): string {
  const displayAmount = pool.tokensPerPill / Math.pow(10, pool.decimals);
  return displayAmount % 1 === 0
    ? displayAmount.toLocaleString()
    : displayAmount.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

export function buildSnapshotPresentation({
  previous,
  snapshot,
  activePools,
  wasThrusting,
}: BuildSnapshotPresentationArgs): SnapshotPresentation {
  const presentation: SnapshotPresentation = {
    explosions: [],
    sounds: [],
    floatingTexts: [],
    collectedPools: [],
    storePatch: {
      score: snapshot.score,
      level: snapshot.level,
      inventory: {
        items: {
          ships: snapshot.lives,
          tokens: snapshot.tokensCollected,
          pills: snapshot.pillsCollected,
        },
        astrdsEarned:
          snapshot.pillsCollected * snapshot.emissionTier.astrdsPerPill,
      },
      powerups: {
        powerups: {
          invincible: snapshot.powerups.invincible,
          rapidFire: snapshot.powerups.rapidFire,
        },
        powerupExpiresAt: snapshot.powerups.expiresAt,
      },
    },
    levelTransitionTo: null,
    respawning: null,
    machineState:
      snapshot.status === "gameOver" ? MachineState.GAME_OVER : null,
  };

  const nowThrusting = snapshot.ship?.isThrusting ?? false;
  if (nowThrusting && !wasThrusting) presentation.sounds.push("thrustStart");
  if (!nowThrusting && wasThrusting) presentation.sounds.push("thrustStop");

  if (!previous) return presentation;

  for (const asteroid of removedPickupsLike(
    previous.asteroids,
    snapshot.asteroids
  )) {
    presentation.explosions.push({
      position: asteroid.position,
      radius: asteroid.radius,
      count: 15,
    });
    presentation.sounds.push(asteroidDestroySound(asteroid.radius));
  }

  if (previous.ship && !snapshot.ship) {
    presentation.explosions.push({
      position: previous.ship.position,
      radius: previous.ship.radius,
      count: 30,
    });
    presentation.sounds.push("explosion");
  }

  if (snapshot.bullets.length > previous.bullets.length) {
    const newCount = snapshot.bullets.length - previous.bullets.length;
    for (let i = 0; i < newCount; i += 1) presentation.sounds.push("shoot");
  }

  if (snapshot.pillsCollected > previous.pillsCollected) {
    presentation.sounds.push("collect");
    const pillDelta = snapshot.pillsCollected - previous.pillsCollected;
    const removedPills = removedPickups(previous.pills, snapshot.pills).slice(
      0,
      pillDelta
    );
    for (const pill of removedPills) {
      presentation.floatingTexts.push({
        x: pill.position.x,
        y: pill.position.y - pill.radius - 4,
        text: `+${snapshot.emissionTier.astrdsPerPill} ASTRDS`,
        color: getAstrdsColor(),
      });
    }
  }

  if (snapshot.tokensCollected > previous.tokensCollected) {
    presentation.sounds.push("spaceTokenCollect");
    const tokenDelta = snapshot.tokensCollected - previous.tokensCollected;
    const removedTokens = removedPickups(
      previous.tokens,
      snapshot.tokens
    ).slice(0, tokenDelta);
    for (const token of removedTokens) {
      const pool = activePools.find(
        (candidate) =>
          candidate._id === token.depositId ||
          candidate.mintAddress === token.mintAddress
      );
      let text = "+SPACE TOKEN";
      if (pool) {
        presentation.collectedPools.push(pool);
        text = `+${formatSpaceTokenAmount(pool)} ${pool.symbol}`;
      }
      presentation.floatingTexts.push({
        x: token.position.x,
        y: token.position.y - token.radius - 4,
        text,
        color: resolveCanvasColor(token.color),
      });
    }
  }

  const powerupActivated =
    (!previous.powerups.invincible && snapshot.powerups.invincible) ||
    (!previous.powerups.rapidFire && snapshot.powerups.rapidFire) ||
    Boolean(
      snapshot.powerups.expiresAt &&
        previous.powerups.expiresAt !== snapshot.powerups.expiresAt
    );
  if (powerupActivated) {
    const pickup = removedPickups(
      previous.powerupPickups,
      snapshot.powerupPickups
    )[0];
    if (pickup) {
      const isCombo = pickup.color === COMBO_POWERUP_COLOR;
      const isShield = pickup.color === SHIELD_PICKUP_COLOR;
      presentation.floatingTexts.push({
        x: pickup.position.x,
        y: pickup.position.y - pickup.radius - 4,
        text: isCombo
          ? "SHIELD + RAPID FIRE"
          : isShield
          ? "SHIELD"
          : "RAPID FIRE",
        color: resolveCanvasColor(pickup.color),
      });
    }
  }

  if (snapshot.lives > previous.lives) {
    const collected = removedPickups(
      previous.shipPickups,
      snapshot.shipPickups
    )[0];
    const pos = collected?.position ?? snapshot.ship?.position;
    if (pos) {
      presentation.floatingTexts.push({
        x: pos.x,
        y: pos.y - 24,
        text: "+1 SHIP",
        color: getCanvasTokens().shipPickupFill,
      });
    }
  }

  if (snapshot.level !== previous.level) {
    presentation.levelTransitionTo = snapshot.level;
  }

  const wasInvulnerable = previous.ship?.isInvulnerable ?? false;
  const nowInvulnerable = snapshot.ship?.isInvulnerable ?? false;
  if (!wasInvulnerable && nowInvulnerable) presentation.respawning = true;
  if (wasInvulnerable && !nowInvulnerable) presentation.respawning = false;

  return presentation;
}

function removedPickupsLike<T extends { id: string }>(
  previous: T[],
  next: T[]
): T[] {
  const nextIds = new Set(next.map((item) => item.id));
  return previous.filter((item) => !nextIds.has(item.id));
}
