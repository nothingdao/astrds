// Helius Enhanced Transaction webhook handler.
// Fires on every transfer to/from the treasury wallet.
// Inbound  → verifies deposit amount and activates pending record.
// Outbound → checks claims table; if unknown, triggers on-chain reconciliation.

import { httpAction } from './_generated/server'
import { internal } from './_generated/api'

const TREASURY_WALLET = 'CNhWD1cXNaCMcjJmFcK25aFgV3ZTAFtyFDBvGfKZcpzF'

interface HeliusTokenTransfer {
  fromUserAccount: string
  toUserAccount: string
  fromTokenAccount?: string
  toTokenAccount?: string
  tokenAmount: number          // UI amount (decimal-adjusted)
  decimals?: number
  mint: string
  tokenStandard?: string
}

interface HeliusTransaction {
  signature: string
  timestamp: number            // unix seconds
  tokenTransfers: HeliusTokenTransfer[]
  transactionError: string | null
  type?: string
}

export const handleTreasuryWebhook = httpAction(async (ctx, request) => {
  // Validate webhook secret if configured
  const secret = process.env.HELIUS_WEBHOOK_SECRET
  if (secret) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== secret) {
      return new Response('Unauthorized', { status: 401 })
    }
  }

  let body: HeliusTransaction[]
  try {
    body = await request.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  if (!Array.isArray(body)) {
    return new Response('Expected array of transactions', { status: 400 })
  }

  for (const tx of body) {
    if (tx.transactionError) continue
    if (!Array.isArray(tx.tokenTransfers) || tx.tokenTransfers.length === 0) continue

    for (const transfer of tx.tokenTransfers) {
      const depositedAt = (tx.timestamp ?? Math.floor(Date.now() / 1000)) * 1000

      if (transfer.toUserAccount === TREASURY_WALLET) {
        // ── Inbound deposit ──────────────────────────────────────────────────
        // Find the pending deposit by tx signature and confirm it with the
        // verified token amount from Helius (source: on-chain balance changes).
        const deposit = await ctx.runQuery(
          internal.spaceDeposits.getDepositBySignature,
          { txSignature: tx.signature }
        )

        if (deposit && deposit.status === 'pending_verification') {
          // Use decimals from the stored deposit (client provided, trusted for
          // decimal count only — the token amount itself comes from Helius).
          const decimals = deposit.decimals ?? 6
          const rawAmount = Math.round(transfer.tokenAmount * 10 ** decimals)

          await ctx.runMutation(internal.spaceDeposits.confirmDeposit, {
            depositId: deposit._id,
            totalAmount: rawAmount,
            depositedAt,
          })
        } else if (!deposit) {
          // Webhook fired before client registered intent — create a minimal record.
          // The depositor will need to add metadata (symbol, tokensPerPill, etc.)
          // manually or via a follow-up action.
          const decimals = transfer.decimals ?? 6
          const rawAmount = Math.round(transfer.tokenAmount * 10 ** decimals)
          await ctx.runMutation(internal.spaceDeposits.insertDepositFromWebhook, {
            txSignature: tx.signature,
            mintAddress: transfer.mint,
            totalAmount: rawAmount,
            depositedAt,
          })
        }
        // If deposit.status === 'active': already confirmed (double webhook), skip.

      } else if (transfer.fromUserAccount === TREASURY_WALLET) {
        // ── Outbound transfer ────────────────────────────────────────────────
        // Check if this matches a recorded game claim. If not, it's an external
        // drain — reconcile the affected pool against on-chain reality.
        const claim = await ctx.runQuery(
          internal.spaceDeposits.getClaimBySignature,
          { txSignature: tx.signature }
        )

        if (!claim) {
          // Unknown outbound transfer — external drain detected.
          // Trigger a Node.js action that reads the actual ATA balance and
          // caps remainingAmount to on-chain reality.
          await ctx.runAction(internal.spaceDepositsActions.reconcilePool, {
            mintAddress: transfer.mint,
          })
        }
        // If claim exists: authorized game payout, already accounted for in
        // Convex via collectFromDeposit at collection time. No action needed.
      }
    }
  }

  return new Response('OK', { status: 200 })
})
