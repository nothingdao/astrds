import { v } from "convex/values";
import {
  httpAction,
  internalMutation,
  mutation,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import {
  DEFAULT_GAME_CONFIG,
  DEFAULT_TIER_BREAKPOINTS_USD,
  DEFAULT_PILLS_PER_TIER,
  DEFAULT_ASTRDS_PER_PILL,
  normalizeGameConfig,
  parseGameConfigPayload,
} from "../../shared/game/gameConfigContract";

// Wallets allowed to save config directly via the Convex mutation (no API key needed).
// The HTTP endpoint is still available for scripted access with ADMIN_API_KEY.
const DEV_WALLETS = new Set([
  "jrXCZwP8bxDnGs7ChD4F77We1K4J89R53SAVk5HsSoE", // deployer / upgrade authority
  "FEb3tauuDVbcErhewnDCFeM2Lt6ddRMwme23UY3ANebg", // astrds player 1
]);

export const DEFAULT_TIER_BREAKPOINTS = [...DEFAULT_TIER_BREAKPOINTS_USD];
export { DEFAULT_PILLS_PER_TIER, DEFAULT_ASTRDS_PER_PILL };
export const DEFAULT_CONFIG = DEFAULT_GAME_CONFIG;

export const getGameConfig = query({
  args: {},
  handler: async (ctx) => {
    const doc = await ctx.db.query("gameConfig").first();
    return normalizeGameConfig(doc);
  },
});

const CONFIG_ARGS = {
  applyToRunning: v.boolean(),
  powerupSpawnDelayMs: v.number(),
  shipPickupSpawnDelayMs: v.number(),
  maxPowerupsOnScreen: v.number(),
  powerupDurationMs: v.number(),
  maxLives: v.number(),
  startingLives: v.number(),
  shipRadius: v.number(),
  shipRotationSpeed: v.number(),
  shipAcceleration: v.number(),
  shipInertia: v.number(),
  shipInvulnerabilityMs: v.number(),
  normalBulletSpeed: v.number(),
  rapidBulletSpeed: v.number(),
  normalFireDelayMs: v.number(),
  rapidFireDelayMs: v.number(),
  bulletRadius: v.number(),
  rapidBulletRadius: v.number(),
  rapidBulletPower: v.number(),
  bulletCollisionPadding: v.number(),
  largeAsteroidRadius: v.number(),
  mediumAsteroidRadius: v.number(),
  smallAsteroidRadius: v.number(),
  asteroidVelocityMin: v.number(),
  asteroidVelocityMax: v.number(),
  asteroidScoreLarge: v.number(),
  asteroidScoreMedium: v.number(),
  asteroidScoreSmall: v.number(),
  pillSpawnDelayMs: v.number(),
  tokenSpawnDelayMs: v.number(),
  spaceTokenSpawnChance: v.number(),
  pickupTtlMs: v.number(),
  pickupRadius: v.number(),
  shipPickupRadius: v.number(),
  maxShipPickupsOnScreen: v.number(),
  progressionBands: v.any(),
  quarterUsd: v.number(),
  tierBreakpointsUsd: v.array(v.number()),
  pillsPerTier: v.array(v.number()),
  astrdsPerPill: v.array(v.number()),
};

// Public mutation — wallet address is validated against DEV_WALLETS.
// Not cryptographically secure (any Convex client can pass any address), but
// acceptable for a dev tool on devnet. HTTP endpoint is the secure path for prod.
// Internal version — used by the HTTP endpoint.
export const setGameConfigInternal = internalMutation({
  args: CONFIG_ARGS,
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("gameConfig").first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        ...args,
        version: existing.version + 1,
      });
    } else {
      await ctx.db.insert("gameConfig", { ...args, version: 1 });
    }
  },
});

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

export const updateConfigHttp = httpAction(async (ctx, request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const apiKey = process.env.ADMIN_API_KEY;
  if (!apiKey) {
    return new Response("Admin API not configured", {
      status: 503,
      headers: CORS_HEADERS,
    });
  }

  const authHeader = request.headers.get("Authorization");
  if (authHeader !== `Bearer ${apiKey}`) {
    return new Response("Unauthorized", { status: 401, headers: CORS_HEADERS });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400, headers: CORS_HEADERS });
  }

  const parsed = parseGameConfigPayload(body);
  if (!parsed.ok) {
    return new Response(parsed.errors[0] ?? "Invalid config", {
      status: 400,
      headers: CORS_HEADERS,
    });
  }

  const { version: _, ...payload } = parsed.config;
  await ctx.runMutation(internal.admin.setGameConfigInternal, payload);

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
});
