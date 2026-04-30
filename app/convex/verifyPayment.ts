"use node";

import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v } from "convex/values";
import { Connection, PublicKey } from "@solana/web3.js";
import { createHash } from "node:crypto";

const SPACE_VAULT_PROGRAM_ID = new PublicKey(
  "4bRZK8XfziVhLCgvtRdFJyTgN6tXGSPJT8xfbtt1AxBB"
);
const GAME_PAYMENT_DISCRIMINATOR = createHash("sha256")
  .update("global:game_payment")
  .digest()
  .subarray(0, 8);

const BASE58_ALPHABET =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const BASE58_MAP = new Map(
  BASE58_ALPHABET.split("").map((char, index) => [char, index])
);

const decodeBase58 = (value: string): Buffer => {
  let bytes = [0];
  for (const char of value) {
    const digit = BASE58_MAP.get(char);
    if (digit === undefined) throw new Error("Invalid base58 data");
    let carry = digit;
    for (let i = 0; i < bytes.length; i += 1) {
      carry += bytes[i] * 58;
      bytes[i] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  for (const char of value) {
    if (char !== "1") break;
    bytes.push(0);
  }
  return Buffer.from(bytes.reverse());
};

const getConnection = (): Connection => {
  const rpcEndpoint = process.env.SOLANA_RPC_ENDPOINT;
  if (!rpcEndpoint) throw new Error("SOLANA_RPC_ENDPOINT not set");
  return new Connection(rpcEndpoint, "confirmed");
};

const accountKeyToString = (key: unknown): string | null => {
  if (typeof key === "string") return key;
  if (key && typeof key === "object") {
    const pubkey = (key as { pubkey?: unknown }).pubkey;
    if (typeof pubkey === "string") return pubkey;
    if (pubkey && typeof pubkey === "object" && "toString" in pubkey)
      return String(pubkey);
    if ("toString" in key) return String(key);
  }
  return null;
};

const getInstructionProgramId = (
  ix: Record<string, unknown>,
  accountKeys: unknown[]
): string | null => {
  if (typeof ix.programId === "string") return ix.programId;
  if (
    ix.programId &&
    typeof ix.programId === "object" &&
    "toString" in ix.programId
  )
    return String(ix.programId);
  if (typeof ix.programIdIndex === "number")
    return accountKeyToString(accountKeys[ix.programIdIndex]);
  return null;
};

const getInstructionData = (ix: Record<string, unknown>): Buffer | null => {
  if (Buffer.isBuffer(ix.data)) return ix.data;
  if (typeof ix.data !== "string") return null;
  return decodeBase58(ix.data);
};

export const verifyPayment = action({
  args: {
    txSignature: v.string(),
    walletAddress: v.string(),
    paymentType: v.union(v.literal("SOL"), v.literal("ASTRDS")),
  },
  handler: async (ctx, { txSignature, walletAddress, paymentType }) => {
    if (paymentType !== "SOL")
      throw new Error("ASTRDS payment is no longer supported");

    const existing = await ctx.runQuery(internal.sessions.getByTxSignature, {
      txSignature,
    });
    if (existing) throw new Error("Payment transaction already used");

    const wallet = new PublicKey(walletAddress);
    const tx = await getConnection().getTransaction(txSignature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });

    if (!tx) throw new Error("Payment transaction not found");
    if (tx.meta?.err) throw new Error("Payment transaction failed");

    const message = tx.transaction.message as unknown as {
      accountKeys?: unknown[];
      staticAccountKeys?: unknown[];
      instructions?: Array<Record<string, unknown>>;
      compiledInstructions?: Array<Record<string, unknown>>;
    };
    const accountKeys = message.accountKeys ?? message.staticAccountKeys ?? [];
    const feePayer = accountKeyToString(accountKeys[0]);
    if (feePayer !== wallet.toBase58())
      throw new Error("Payment fee payer does not match wallet");

    const signerMatches = accountKeys.some((key) => {
      if (!key || typeof key !== "object") return false;
      const record = key as { pubkey?: unknown; signer?: unknown };
      return (
        record.signer === true &&
        accountKeyToString(record.pubkey ?? key) === wallet.toBase58()
      );
    });
    // Non-json transaction responses do not expose the signer flag; fee-payer match is still required.
    if (
      accountKeys.some(
        (key) => key && typeof key === "object" && "signer" in key
      ) &&
      !signerMatches
    ) {
      throw new Error("Payment signer does not match wallet");
    }

    let paidLamports: bigint | null = null;
    const instructions =
      message.instructions ?? message.compiledInstructions ?? [];
    for (const ix of instructions) {
      if (
        getInstructionProgramId(ix, accountKeys) !==
        SPACE_VAULT_PROGRAM_ID.toBase58()
      )
        continue;
      const data = getInstructionData(ix);
      if (!data || data.length < 16) continue;
      if (!data.subarray(0, 8).equals(GAME_PAYMENT_DISCRIMINATOR)) continue;
      paidLamports = data.readBigUInt64LE(8);
      break;
    }
    if (paidLamports === null)
      throw new Error("Transaction did not call game_payment");

    const [config, solUsd] = await Promise.all([
      ctx.runQuery(api.admin.getGameConfig, {}),
      ctx.runAction(api.prices.getSolUsdPrice, { maxAgeMs: 60_000 }),
    ]);
    const quarterUsd = Number(config?.quarterUsd ?? 0.25);
    const solUsdPrice = Number(solUsd.priceUsd);
    if (
      !Number.isFinite(quarterUsd) ||
      quarterUsd <= 0 ||
      !Number.isFinite(solUsdPrice) ||
      solUsdPrice <= 0
    ) {
      throw new Error("Unable to determine required payment amount");
    }
    const requiredLamports = BigInt(
      Math.ceil((quarterUsd / solUsdPrice) * 1e9)
    );
    if (paidLamports < requiredLamports) {
      throw new Error(
        `Payment too small: paid ${paidLamports.toString()} lamports, required ${requiredLamports.toString()}`
      );
    }

    await ctx.runMutation(internal.sessions.createVerifiedSession, {
      walletAddress,
      txSignature,
      paymentType,
    });

    return { success: true };
  },
});
