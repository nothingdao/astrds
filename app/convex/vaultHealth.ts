"use node";

// Vault health check — enumerates all on-chain DepositPool PDAs, cross-references
// Convex records, and can sync missing or mismatched pools back into Convex.

import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { Connection, PublicKey } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";

const VAULT_PROGRAM_ID = "4bRZK8XfziVhLCgvtRdFJyTgN6tXGSPJT8xfbtt1AxBB";

// DepositPool Anchor account size: 8 discriminator + 32+32+8+8+1+1 = 90 bytes
const DEPOSIT_POOL_SIZE = 90;

function parseDepositPool(pubkey: PublicKey, data: Buffer) {
  return {
    address: pubkey.toString(),
    depositor: new PublicKey(data.slice(8, 40)).toString(),
    mint: new PublicKey(data.slice(40, 72)).toString(),
    totalDeposited: Number(data.readBigUInt64LE(72)),
    remaining: Number(data.readBigUInt64LE(80)),
    active: data[88] === 1,
  };
}

async function getTokenMetadata(mintAddress: string, rpcEndpoint: string) {
  try {
    const res = await fetch(rpcEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getAsset",
        params: { id: mintAddress },
      }),
    });
    const json = (await res.json()) as any;
    const asset = json.result;
    if (!asset) return null;
    return {
      symbol: asset.content?.metadata?.symbol ?? "???",
      name: asset.content?.metadata?.name ?? mintAddress.slice(0, 8),
      decimals: asset.token_info?.decimals ?? 6,
      logoUri: (asset.content?.links?.image ??
        asset.content?.files?.[0]?.uri) as string | undefined,
    };
  } catch {
    return null;
  }
}

// ── vaultHealthCheck ──────────────────────────────────────────────────────────
// Read-only: returns a report comparing on-chain pools to Convex records.
export const vaultHealthCheck = action({
  args: {},
  handler: async (ctx) => {
    const rpcEndpoint = process.env.SOLANA_RPC_ENDPOINT;
    if (!rpcEndpoint) throw new Error("SOLANA_RPC_ENDPOINT not set");

    const connection = new Connection(rpcEndpoint, "confirmed");
    const programId = new PublicKey(VAULT_PROGRAM_ID);

    const accounts = await connection.getProgramAccounts(programId, {
      filters: [{ dataSize: DEPOSIT_POOL_SIZE }],
    });

    const onChainPools = accounts.map(({ pubkey, account }) =>
      parseDepositPool(pubkey, Buffer.from(account.data as Buffer))
    );

    const convexDeposits = await ctx.runQuery(
      internal.spaceDeposits.getAllDeposits,
      {}
    );

    const convexByKey = new Map(
      convexDeposits.map((d) => [`${d.walletAddress}:${d.mintAddress}`, d])
    );
    const onChainByKey = new Map(
      onChainPools.map((p) => [`${p.depositor}:${p.mint}`, p])
    );

    const missing: typeof onChainPools = [];
    const mismatched: {
      onChain: (typeof onChainPools)[0];
      convexRemaining: number;
      convexStatus: string;
    }[] = [];
    const healthy: typeof onChainPools = [];

    for (const pool of onChainPools) {
      const key = `${pool.depositor}:${pool.mint}`;
      const convex = convexByKey.get(key) as any;
      if (!convex) {
        missing.push(pool);
      } else if (convex.remainingAmount !== pool.remaining) {
        mismatched.push({
          onChain: pool,
          convexRemaining: convex.remainingAmount,
          convexStatus: convex.status,
        });
      } else {
        healthy.push(pool);
      }
    }

    const orphaned = (convexDeposits as any[])
      .filter((d) => {
        const key = `${d.walletAddress}:${d.mintAddress}`;
        return !onChainByKey.has(key);
      })
      .map((d) => ({
        id: d._id,
        walletAddress: d.walletAddress,
        mintAddress: d.mintAddress,
        symbol: d.symbol,
        status: d.status,
      }));

    return { missing, mismatched, healthy, orphaned };
  },
});

// ── syncVaultToConvex ─────────────────────────────────────────────────────────
// Write: upserts Convex records for each provided pool address.
// Creates missing records with sane defaults; corrects balance mismatches.
export const syncVaultToConvex = action({
  args: {
    poolAddresses: v.array(v.string()),
  },
  handler: async (ctx, { poolAddresses }) => {
    const rpcEndpoint = process.env.SOLANA_RPC_ENDPOINT;
    if (!rpcEndpoint) throw new Error("SOLANA_RPC_ENDPOINT not set");

    const connection = new Connection(rpcEndpoint, "confirmed");
    const results: {
      address: string;
      symbol: string;
      action: string;
      error?: string;
    }[] = [];

    for (const address of poolAddresses) {
      try {
        const pubkey = new PublicKey(address);
        const accountInfo = await connection.getAccountInfo(
          pubkey,
          "confirmed"
        );
        if (!accountInfo) {
          results.push({
            address,
            symbol: "?",
            action: "skipped",
            error: "Account not found on-chain",
          });
          continue;
        }

        const pool = parseDepositPool(
          pubkey,
          Buffer.from(accountInfo.data as Buffer)
        );
        const meta = await getTokenMetadata(pool.mint, rpcEndpoint);

        const mintInfo = await connection.getAccountInfo(
          new PublicKey(pool.mint),
          "confirmed"
        );
        const programId = mintInfo?.owner.equals(TOKEN_2022_PROGRAM_ID)
          ? "TOKEN_2022"
          : "TOKEN";

        const decimals = meta?.decimals ?? 6;
        const tokensPerPill = 100 * Math.pow(10, decimals);

        const result = await ctx.runMutation(
          internal.spaceDeposits.upsertRecoveredDeposit,
          {
            poolAddress: address,
            walletAddress: pool.depositor,
            mintAddress: pool.mint,
            programId,
            symbol: meta?.symbol ?? "???",
            name: meta?.name ?? pool.mint.slice(0, 8),
            logoUri: meta?.logoUri,
            decimals,
            totalAmount: pool.totalDeposited,
            remainingAmount: pool.remaining,
            tokensPerPill,
          }
        );

        results.push({
          address,
          symbol: meta?.symbol ?? "???",
          action: result.created ? "created" : "updated",
        });
      } catch (err) {
        results.push({
          address,
          symbol: "?",
          action: "error",
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return { results };
  },
});
