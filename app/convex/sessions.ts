import {
  httpAction,
  internalMutation,
  internalQuery,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

const SESSION_TTL_MS = 30 * 60 * 1000;

export const createVerifiedSession = internalMutation({
  args: {
    walletAddress: v.string(),
    txSignature: v.string(),
    paymentType: v.union(v.literal("SOL"), v.literal("ASTRDS")),
  },
  handler: async (ctx, { walletAddress, txSignature, paymentType }) => {
    const existing = await ctx.db
      .query("verifiedSessions")
      .withIndex("by_tx", (q) => q.eq("txSignature", txSignature))
      .first();
    if (existing) throw new Error("Payment transaction already used");

    const now = Date.now();
    await ctx.db.insert("verifiedSessions", {
      walletAddress,
      txSignature,
      paymentType,
      verifiedAt: now,
      expiresAt: now + SESSION_TTL_MS,
      consumed: false,
    });
  },
});

export const isVerified = query({
  args: { walletAddress: v.string() },
  handler: async (ctx, { walletAddress }) => {
    const session = await ctx.db
      .query("verifiedSessions")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", walletAddress))
      .order("desc")
      .first();
    if (!session) return false;
    return session.expiresAt > Date.now() && session.consumed !== true;
  },
});

export const getByTxSignature = internalQuery({
  args: { txSignature: v.string() },
  handler: async (ctx, { txSignature }) => {
    return ctx.db
      .query("verifiedSessions")
      .withIndex("by_tx", (q) => q.eq("txSignature", txSignature))
      .first();
  },
});

export const clearSession = internalMutation({
  args: { walletAddress: v.string() },
  handler: async (ctx, { walletAddress }) => {
    const sessions = await ctx.db
      .query("verifiedSessions")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", walletAddress))
      .collect();
    await Promise.all(sessions.map((s) => ctx.db.delete(s._id)));
  },
});

export const consumeSession = internalMutation({
  args: { walletAddress: v.string() },
  handler: async (ctx, { walletAddress }) => {
    const session = await ctx.db
      .query("verifiedSessions")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", walletAddress))
      .order("desc")
      .first();
    if (
      !session ||
      session.expiresAt <= Date.now() ||
      session.consumed === true
    ) {
      return { consumed: false };
    }
    await ctx.db.patch(session._id, { consumed: true });
    return { consumed: true };
  },
});

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

const requireServerAuth = (request: Request): Response | null => {
  const apiKey = process.env.ADMIN_API_KEY;
  if (!apiKey)
    return new Response("Not configured", {
      status: 503,
      headers: CORS_HEADERS,
    });
  if (request.headers.get("Authorization") !== `Bearer ${apiKey}`) {
    return new Response("Unauthorized", { status: 401, headers: CORS_HEADERS });
  }
  return null;
};

export const consumeSessionHttp = httpAction(async (ctx, request) => {
  if (request.method === "OPTIONS")
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  const authError = requireServerAuth(request);
  if (authError) return authError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400, headers: CORS_HEADERS });
  }
  const { walletAddress } = body as Record<string, unknown>;
  if (typeof walletAddress !== "string")
    return new Response("Invalid body", { status: 400, headers: CORS_HEADERS });

  const result = await ctx.runMutation(internal.sessions.consumeSession, {
    walletAddress,
  });
  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
});
