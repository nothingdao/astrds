import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getMessages = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("chatMessages").order("asc").take(100);
  },
});

export const sendMessage = mutation({
  args: {
    walletAddress: v.string(),
    message: v.string(),
  },
  handler: async (ctx, { walletAddress, message }) => {
    const id = await ctx.db.insert("chatMessages", {
      walletAddress,
      message,
      timestamp: new Date().toISOString(),
    });

    // Keep last 100 messages
    const all = await ctx.db.query("chatMessages").order("asc").collect();
    if (all.length > 100) {
      await Promise.all(
        all.slice(0, all.length - 100).map((m) => ctx.db.delete(m._id))
      );
    }

    return await ctx.db.get(id);
  },
});
