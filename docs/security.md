---
updated: 2026-04-29
---

# Security & Economy Findings

Consolidated from two external AI audits (Gemini, Codex/Pi) plus first-party review.
Stale/incorrect claims from the source audits are noted where relevant.

---

## Fixed This Session

These were real vulnerabilities, now closed.

| # | What | Fix |
|---|---|---|
| 1 | `astrdsEarned` writable by any browser via public `gameSessions.update` | Removed from public mutation; server writes via `POST /game-server/set-astrds-earned` with `ADMIN_API_KEY` |
| 2 | `prepareMint` accepted any `gameSessionId` with any `playerWalletAddress` — player B could steal player A's ASTRDS and burn their MintRecord | Added `session.walletAddress !== playerWalletAddress` check |
| 3 | `setGameConfig` checked wallet address as a plain string; dev wallet addresses are in the public repo | Public mutation deleted; admin UI now POSTs to `/admin/config` HTTP endpoint with API key |
| 4 | `finalizeClaim` had no ownership check — anyone knowing another player's collection IDs could mark them claimed with a fake tx signature | Handler now verifies every collection belongs to `playerWalletAddress` before patching |
| 5 | `confirmDepositFromChain` trusted client-supplied `remainingAmount`; anyone could create fake active pools | Added depositor ownership check and amount sanity validation |

---

## Open — Security (pre-mainnet)

### HIGH: `verifyPayment` does zero on-chain verification

`app/convex/verifyPayment.ts` takes `txSignature` from the client and immediately creates a `verifiedSession` without fetching the transaction from RPC, verifying it succeeded, checking the instruction was `game_payment`, confirming the signer matches `walletAddress`, validating the lamport amount, or deduplicating the signature.

Any string passes. One real payment signature can be replayed indefinitely to generate unlimited verifiedSessions. The "Insert Quarter" gate is currently UX-only.

**Fix:** In `verifyPayment`, fetch the tx via Solana RPC, confirm it succeeded, parse the instruction, verify signer + amount + program, check `txSignature` isn't already in `verifiedSessions`.

---

### HIGH: Fail-open auth in game server

`server/src/ws/SessionHandler.ts` lines 146–156:

```ts
let isVerified = true
try {
  isVerified = await this.convex.isVerifiedSession({ walletAddress })
} catch {
  isVerified = true   // ← Convex error = free play for everyone
}
```

If Convex is slow, rate-limited, or briefly down, every connection is admitted regardless of payment. The comment in the code acknowledges this ("allowing gameplay to proceed").

**Fix:** On Convex error, reject the connection. Free play is worse than a brief outage.

---

### MEDIUM: `clearSession` is a public mutation with no ownership check

`app/convex/sessions.ts` exports `clearSession` as a plain public mutation. It takes `walletAddress: v.string()` and deletes all verified sessions for that wallet — no proof of ownership required. Anyone can call it in the browser console with any wallet address to invalidate a player's paid session mid-game.

Neither external audit caught this.

**Fix:** Make `clearSession` an `internalMutation`; call it only from trusted server-side flows, or add a session token/nonce that the client must present.

---

### MEDIUM: One quarter payment covers unlimited games within 30 minutes

`SESSION_TTL_MS = 30 * 60 * 1000`. The session is never consumed when a game starts. A skilled player can complete several games in a 30-minute window on a single payment. `clearSession` is called on disconnect but not at game start.

Whether this is a bug or an acceptable UX tradeoff is a design decision, but it diverges from the stated "1 quarter = 1 game" model.

**Fix (if 1 quarter = 1 game is the intent):** Mark the verifiedSession as used when the game server admits a connection, or delete it at game start.

---

### MEDIUM: `prepareClaims` double-signing window

`prepareClaims` generates a new random `claimId` on every call and signs authorizations for all collections currently in `status: 'pending'`. If called twice before `finalizeClaim` runs, both calls produce valid signatures for the same collections — each with a different `claimId` and therefore a different `ClaimRecord` PDA. Both can be submitted on-chain if the vault has sufficient balance.

Partially mitigated by the vault's actual token balance — if the pool is drained by the first claim the second fails on-chain. But for large pools it's exploitable.

**Fix:** Set collection status to `'claiming'` before signing and only sign collections in `'pending'` state.

---

### LOW: Public mutations with no session ownership check (cosmetic impact only)

`gameSessions.update` (score, levelReached) and `gameSessions.incrementPillsCollected` have no check that the caller owns the session. Anyone who knows a session ID can inflate scores and pill counts. Session IDs are Convex document IDs — not easy to enumerate, but visible in network traffic.

No token impact. Leaderboard/stat integrity only.

---

### LOW: `gameSessions.create` spam

No rate limit. Anyone can create unlimited game session records for any wallet address. DB pollution, no financial impact.

---

## Open — Economy (mainnet blockers)

These are not security exploits on devnet but must be resolved before mainnet.

### 21M ASTRDS hard cap not enforced on-chain

`mint_astrds` verifies the ed25519 authorization and replay protection but does not check the current mint supply. The 21M cap exists only as a frontend constant. If the Convex authority key is compromised or a minting bug exists, the program will mint beyond the cap.

**Fix:** Add to `mint_astrds`:
```rust
require!(
    ctx.accounts.astrds_mint.supply.checked_add(amount)
        .ok_or(SpaceVaultError::MathOverflow)? <= ASTRDS_SUPPLY_CAP_RAW,
    SpaceVaultError::SupplyCapExceeded
);
```

---

### Fractional tier-5 emission rounded down

At tier 5, `astrdsPerPill = 0.5`. The server computes:
```ts
Math.floor(pillsCollected * 0.5)
```
Players at tier 5 collecting an odd number of pills lose 0.5 ASTRDS per uncounted pill. At 99 pills they earn 49 ASTRDS instead of 49.5. ASTRDS has 9 decimals so fractional amounts are technically supported.

**Fix:** Store `astrdsEarnedRaw` as a bigint string in Convex using integer math (e.g., multiply pills × astrdsPerPill × 10^9), pass raw units through `prepareMint`, and display as decimal in the UI.

---

### Legacy `mintTokens` action still exists

`app/convex/tokens.ts` still exports the old direct-mint action that bypassed the on-chain path. It fails today because mint authority was transferred to the VaultConfig PDA, but it represents dead API surface that could mislead future code or cause issues if authority were ever reconfigured.

**Fix:** Either delete it or replace the handler with `throw new Error('Disabled')`.

---

### Burned ASTRDS accounting is off-chain only

The stated model is "50 ASTRDS reserved per game; uncollected amount burned." The game server now records `astrdsAllocated`, `astrdsEarned`, and `astrdsBurned` at game over via the authenticated `/game-server/set-astrds-earned` path, so the accounting is queryable in Convex. There is still no on-chain reservation or burn transaction; uncollected allocation is represented as "never minted" plus Convex accounting.

**Fix before mainnet:** Decide whether Convex accounting is sufficient for the product narrative, or add explicit on-chain supply/accounting state.

---

### 420,000 game cap and pricing formula are docs-only

The 420,000 game emission schedule and the older burn-adjusted pricing formula (`price = pool SOL value × SOL/USD / (21M - burned)`) exist as design targets but are not enforced on-chain. Current runtime tiering uses the Meteora DAMM reserve-ratio spot price and SOL/USD from the shared Convex price endpoint.

These are design decisions that need to be made canonical before mainnet — either implement them or update the docs to match what the code actually does.

---

## What the External Audits Got Wrong

- **CRIT-01 (free play via astrdsEarned)**: Framed as a verifyPayment issue in the security audit but the actual exploit path was `gameSessions.update`. Both are real; the framing was imprecise. The update path is now fixed; verifyPayment remains open.
- **CRIT-02 (claim replay)**: Described as the Solana program "only checking claimId" — the program does check claimId via ClaimRecord PDA, which is correct. The actual window is in Convex (multiple prepareClaims calls before finalizeClaim). The on-chain layer is not broken.
- **ECON-MED-03 (admin config wallet gate)**: Now fixed — the public `setGameConfig` mutation was removed.
- **Authoritative server `dt` manipulation**: The game server controls `dt` internally; the client sends input events, not delta time. Not a real attack surface.
- **`clearSession` griefing**: Missed by both audits. Real and currently open.
