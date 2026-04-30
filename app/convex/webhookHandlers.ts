// Helius Enhanced Transaction webhook handler.
// Fires on every transaction involving the Space Vault program
// (4bRZK8XfziVhLCgvtRdFJyTgN6tXGSPJT8xfbtt1AxBB).
//
// Deposit detection: not needed for UI-driven deposits — those call
// confirmDepositFromChain directly. Webhook catches direct on-chain deposits
// (bypassing the UI) by looking for pending records with matching tx signature.
//
// Drain detection: any tx that moves tokens and isn't a recorded claim triggers
// reconcilePool for the affected mint. The hourly cron is the fallback.

import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

interface HeliusTokenTransfer {
  fromUserAccount: string;
  toUserAccount: string;
  fromTokenAccount?: string;
  toTokenAccount?: string;
  tokenAmount: number; // UI amount (decimal-adjusted)
  decimals?: number;
  mint: string;
  tokenStandard?: string;
}

interface HeliusTransaction {
  signature: string;
  timestamp: number; // unix seconds
  tokenTransfers: HeliusTokenTransfer[];
  transactionError: string | null;
  type?: string;
}

export const handleTreasuryWebhook = httpAction(async (ctx, request) => {
  const secret = process.env.HELIUS_WEBHOOK_SECRET;
  if (secret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== secret) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  let body: HeliusTransaction[];
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  if (!Array.isArray(body)) {
    return new Response("Expected array of transactions", { status: 400 });
  }

  for (const tx of body) {
    if (tx.transactionError) continue;
    const transfers = tx.tokenTransfers;
    if (!Array.isArray(transfers) || transfers.length === 0) continue;

    const depositedAt = (tx.timestamp ?? Math.floor(Date.now() / 1000)) * 1000;

    // ── Authorized claim? ────────────────────────────────────────────────────
    // If this tx is already recorded as a game claim, nothing to do.
    const claim = await ctx.runQuery(
      internal.spaceDeposits.getClaimBySignature,
      { txSignature: tx.signature }
    );
    if (claim) continue;

    // ── Pending deposit activation ───────────────────────────────────────────
    // UI-driven deposits call confirmDepositFromChain directly after the tx.
    // Direct on-chain deposits (bypassing the UI) may have created a pending
    // record via registerDepositIntent before sending — detect by tx signature.
    const pendingDeposit = await ctx.runQuery(
      internal.spaceDeposits.getDepositBySignature,
      { txSignature: tx.signature }
    );
    if (pendingDeposit && pendingDeposit.status === "pending_verification") {
      for (const transfer of transfers) {
        const decimals = pendingDeposit.decimals ?? transfer.decimals ?? 6;
        const rawAmount = Math.round(transfer.tokenAmount * 10 ** decimals);
        if (rawAmount > 0 && transfer.mint === pendingDeposit.mintAddress) {
          await ctx.runMutation(internal.spaceDeposits.confirmDeposit, {
            depositId: pendingDeposit._id,
            totalAmount: rawAmount,
            depositedAt,
          });
          break;
        }
      }
      continue;
    }

    // ── Drain detection ──────────────────────────────────────────────────────
    // Unrecognized tx involving the vault program with token transfers.
    // Reconcile every mint involved to cap Convex balances to on-chain reality.
    const mints = new Set(transfers.map((t) => t.mint));
    for (const mintAddress of mints) {
      await ctx.runAction(internal.spaceDepositsActions.reconcilePool, {
        mintAddress,
      });
    }
  }

  return new Response("OK", { status: 200 });
});
