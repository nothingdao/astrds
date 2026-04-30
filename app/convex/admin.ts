import { httpAction, internalMutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  DEFAULT_GAME_CONFIG,
  DEFAULT_TIER_BREAKPOINTS_USD,
  DEFAULT_PILLS_PER_TIER,
  DEFAULT_ASTRDS_PER_PILL,
  normalizeGameConfig,
  parseGameConfigPayload,
} from "../../shared/game/gameConfigContract";
import { REQUIRED_GAME_CONFIG_FIELDS } from "./gameConfigValidators";

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

// Internal version — used by the authenticated HTTP endpoint.
export const setGameConfigInternal = internalMutation({
  args: REQUIRED_GAME_CONFIG_FIELDS,
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
