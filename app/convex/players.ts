import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const saveAvatar = mutation({
  args: {
    walletAddress: v.string(),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, { walletAddress, storageId }) => {
    const existing = await ctx.db
      .query("players")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", walletAddress))
      .first();

    if (existing) {
      // Delete old avatar from storage if present
      if (existing.avatarStorageId) {
        await ctx.storage.delete(existing.avatarStorageId);
      }
      await ctx.db.patch(existing._id, {
        avatarStorageId: storageId,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("players", {
        walletAddress,
        avatarStorageId: storageId,
        updatedAt: Date.now(),
      });
    }
  },
});

export const getAvatarUrl = query({
  args: { walletAddress: v.string() },
  handler: async (ctx, { walletAddress }) => {
    const player = await ctx.db
      .query("players")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", walletAddress))
      .first();
    if (!player?.avatarStorageId) return null;
    return await ctx.storage.getUrl(player.avatarStorageId);
  },
});

// Batch query — used by chat and leaderboard to load all avatars at once
export const getAvatarUrls = query({
  args: { walletAddresses: v.array(v.string()) },
  handler: async (ctx, { walletAddresses }) => {
    const result: Record<string, string | null> = {};
    await Promise.all(
      walletAddresses.map(async (wallet) => {
        const player = await ctx.db
          .query("players")
          .withIndex("by_wallet", (q) => q.eq("walletAddress", wallet))
          .first();
        result[wallet] = player?.avatarStorageId
          ? await ctx.storage.getUrl(player.avatarStorageId)
          : null;
      })
    );
    return result;
  },
});
