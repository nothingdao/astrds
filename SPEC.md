---
status: current
updated: 2026-04-16
---

# ASTRDS — Product Spec

Feature source of truth. Update this as features ship, change, or get cut.

## Core Flows

### 1. Pay to Play ("Insert Quarter")
- Player connects Solana wallet
- Clicks "Insert Quarter" → wallet signs a Solana transaction
- `verifyPayment` Convex action confirms tx on-chain → creates verified session
- State machine transitions: `INITIAL → READY_TO_PLAY`
- Session expires; expired session returns to `INITIAL`

### 2. Gameplay — ASTRDS Tokens
- Player flies ship, shoots asteroids, collects Pill entities
- Each Pill collected increments `inventoryStore` ASTRDS count
- Max 200 ASTRDS tokens per game session
- On game over → `ASTRDSMinting` component shows count and triggers `mintTokens` action
- `mintTokens` calls SPL `mintTo` via authority keypair → tokens land in player wallet

### 3. Tokens in Space — Deposit
- Any wallet can open `SendToSpaceOverlay` and deposit any SPL token into the treasury
- Steps: pick token → configure (amount, tokensPerPill, level range) → sign tx → verify
- Deposit flow uses `registerDepositIntent` (creates pending record) → tx sign → `submitDepositTransaction` (attaches sig) → `verifyAndConfirmDeposit` action (reads tx.meta) or Helius webhook → status flips to `active`
- Amount is verified on-chain — client cannot inflate pool size
- `tokensPerPill` and level range (minLevel/maxLevel) configurable per deposit

### 4. Tokens in Space — Collection
- During gameplay, `engineStore.spawnToken()` selects eligible pools for current level
- Token entities spawn with deterministic color per mint address
- Ship-token collision → `collectFromDeposit` mutation (atomic, race-safe) → `spaceTokenStore.recordCollection()`
- HUD shows per-token-type dot + symbol + count (bottom-right)
- Pool decremented at collection time to prevent over-commitment

### 5. Tokens in Space — Claim
- Game over screen shows `SpaceTokenClaim` with all collected space tokens grouped by mint
- Player clicks "Claim" → `claimSpaceTokens` Convex action:
  - Probes treasury ATA under TOKEN_2022 then TOKEN program
  - Transfers claimable amount from treasury to player ATA via authority keypair
  - Records claim in `claims` table with tx signature
- Dev-seeded deposits skip on-chain entirely (Convex-only accounting)
- Depleted deposits are still claimable — pool slot was reserved at collection time

### 6. Account Screen
- Shows wallet SOL + ASTRDS balances (fetched from chain via `getTokenBalances`)
- Performance stats: total games, best score, average score, play time, leaderboard rank
- Recent games list (last 5)
- Space token claims history (last 10 on-chain claims, persistent across all game sessions)
- Player avatar upload (stored in Convex file storage)

## Functional Requirements

- [x] Wallet auth survives page refresh within session expiry window
- [x] ASTRDS mint is server-side — client cannot trigger minting without verified session
- [x] Space deposit amounts verified on-chain — client input not trusted
- [x] Pool decrement is atomic (Convex serialized mutations) — safe under concurrent players
- [x] Claims are persistent — visible on AccountScreen across all games
- [x] Webhook handler verifies `Authorization` header before processing
- [x] `reconcileAllPools` cron runs hourly to cap balances to on-chain reality
- [x] External treasury drains detected via webhook outbound check against `claims` table
- [x] Dev deposits bypass on-chain entirely — testable without real tokens

## Non-Functional Requirements

- Convex mutations are serialized per document — race conditions on pool decrement are structurally impossible
- Treasury wallet `CNhWD1cXNaCMcjJmFcK25aFgV3ZTAFtyFDBvGfKZcpzF` is the single authority for all outbound transfers
- `PROGRAM_AUTHORITY_PRIVATE_KEY` never leaves Convex — never in frontend bundle
- Helius webhook secret (`HELIUS_WEBHOOK_SECRET`) validated server-side on every POST
- Depleted pools remain queryable — needed to serve pending claim payouts

## Nice To Have

- Mobile controls
- Mainnet migration (economy design not settled)
- Code splitting (bundle currently ~500KB+)
- Error boundary / user-facing error UI for failed score submission or mint
- Surface real $ASTRDS token balance in AccountScreen (currently fetched from chain but `getTokenBalances` util is minimal)
- Show claim status per-token in game over screen (currently shows success/fail for whole batch)

## Known Issues

- Player who collects a space token but closes browser before claiming: pool slot consumed, treasury tokens never paid out (accepted limitation)
- Two players simultaneously collecting the last token in a pool: first mutation wins, second player's token vanishes silently (extremely rare edge case, accepted)
- Pre-existing TypeScript strict mode errors in game entities and UI components (implicit `any`)
- `eval` warning from a rollup dependency in the build
- Helius devnet `INITIALIZE_ACCOUNT` transactions have empty `tokenTransfers` in enhanced format — webhook handler falls back to `verifyAndConfirmDeposit` action path in this case
