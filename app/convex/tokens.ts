"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { Keypair, PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";
import { internal } from "./_generated/api";
import {
  buildMintAstrdsAuthorizationMessage,
  sessionIdToBytes,
} from "../../shared/vault/messages";

const TOKEN_DECIMALS = 9;
// Max ASTRDS any emission tier can award per game (100 pills × 0.5 = 50 at tier 5).
// Checked server-side before minting.
const MAX_ASTRDS_PER_GAME = 50;

const loadAuthority = (): Keypair => {
  const raw = process.env.PROGRAM_AUTHORITY_PRIVATE_KEY;
  if (!raw) throw new Error("PROGRAM_AUTHORITY_PRIVATE_KEY not set");
  return Keypair.fromSecretKey(new Uint8Array(JSON.parse(raw)));
};

export const mintTokens = action({
  args: {},
  handler: async () => {
    throw new Error(
      "Disabled — use prepareMint + mint_astrds on-chain instruction"
    );
  },
});

// Returns a signed mint authorization. The client uses this with
// buildMintAstrdsTransaction to submit an on-chain mint_astrds instruction.
export const prepareMint = action({
  args: {
    playerWalletAddress: v.string(),
    tokenCount: v.optional(v.number()),
    tokenAmountRaw: v.optional(v.string()),
    gameSessionId: v.string(),
  },
  handler: async (
    ctx,
    { playerWalletAddress, tokenCount, tokenAmountRaw, gameSessionId }
  ) => {
    const rawAmount =
      tokenAmountRaw !== undefined
        ? BigInt(tokenAmountRaw)
        : BigInt(Math.round((tokenCount ?? 0) * 10 ** TOKEN_DECIMALS));
    const maxRaw = BigInt(MAX_ASTRDS_PER_GAME) * BigInt(10 ** TOKEN_DECIMALS);
    if (rawAmount <= 0n || rawAmount > maxRaw) {
      throw new Error(
        `Invalid token amount: must be between 0 and ${MAX_ASTRDS_PER_GAME} ASTRDS`
      );
    }

    // Poll until the game server writes astrdsEarned (it does so async after game over).
    let session: any = null;
    for (let attempt = 0; attempt < 8; attempt++) {
      session = await ctx.runQuery(internal.gameSessions.getInternal, {
        sessionId: gameSessionId,
      });
      if (
        session?.astrdsEarned !== undefined ||
        session?.astrdsEarnedRaw !== undefined
      )
        break;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    if (!session) throw new Error("Game session not found");
    if (session.walletAddress !== playerWalletAddress) {
      throw new Error("Session does not belong to this wallet");
    }
    const earnedRaw =
      session.astrdsEarnedRaw !== undefined
        ? BigInt(session.astrdsEarnedRaw)
        : BigInt(
            Math.round((session.astrdsEarned ?? 0) * 10 ** TOKEN_DECIMALS)
          );
    if (earnedRaw <= 0n) {
      throw new Error(
        "Game server has not submitted your final score yet — please wait a moment and try again"
      );
    }
    if (rawAmount > earnedRaw) {
      throw new Error(`Claimed amount exceeds earned amount`);
    }

    const authority = loadAuthority();
    const playerPubkey = new PublicKey(playerWalletAddress);
    const expiry = Math.floor(Date.now() / 1000) + 5 * 60;

    // Encode game session ID as 32-byte identifier (UTF-8, zero-padded).
    // The on-chain MintRecord PDA uses this for replay protection.
    const sessionIdBytes = sessionIdToBytes(gameSessionId);
    const message = buildMintAstrdsAuthorizationMessage({
      player: playerPubkey,
      amount: rawAmount,
      sessionId: sessionIdBytes,
      expiry,
    });
    const signature = nacl.sign.detached(message, authority.secretKey);

    return {
      // Send as string to survive JSON serialization without precision loss.
      amount: rawAmount.toString(),
      sessionId: Array.from(sessionIdBytes),
      expiry,
      signature: Array.from(signature),
    };
  },
});
