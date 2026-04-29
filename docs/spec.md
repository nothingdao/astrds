---
status: current
updated: 2026-04-29
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
- Player flies ship, shoots asteroids, collects Pill entities (server-authoritative)
- Each Pill collected increments `inventoryStore` ASTRDS count and is tracked server-side
- Max 50 ASTRDS per game session; emission tier (1–5 by pool price) controls pills spawned + ASTRDS per pill; uncollected pills are burned
- Emission tier locked at session start by the game server after refreshing latest admin config and reading the Meteora pool — client cannot influence rate
- On game over → game server POSTs earned amount to Convex → `ASTRDSMinting` shows count → `prepareMint` action signs ed25519 authorization → client submits on-chain `mint_astrds` tx → VaultConfig PDA CPIs `mintTo` → tokens land in player wallet

### 3. Tokens in Space — Deposit
- Any wallet can open `SendToSpaceOverlay` and deposit any SPL token into the on-chain vault
- Steps: pick token → configure (amount, tokensPerPill, level range, spawn mode) → sign tx → confirm
- Deposit flow:
  1. `registerDepositIntent` creates pending Convex record
  2. Client calls `buildSendToSpaceTransaction` (spaceVault.ts) — `registerPool` + `deposit` instructions
  3. Player signs and sends on-chain → tokens land in DepositPool PDA's `vaultAta`
  4. `confirmDepositFromChain` mutation activates the record with pool address
  5. `verifyAndConfirmDeposit` action runs in parallel — reads `tx.meta` to set the verified on-chain amount
- Amount set by `verifyAndConfirmDeposit` is authoritative — client cannot inflate pool size
- `tokensPerPill` and level range (minLevel/maxLevel) configurable per deposit

### 4. Tokens in Space — Spawn & Collection
- During gameplay, the game server selects eligible pools for the current level and calls `requestSpawnTicket` (Convex mutation) — validates active paid session, checks per-player cooldown by spawn mode (steady / escalating / wave), and issues a one-time `spawnTickets` record
- Game server injects a `Token` entity into the authoritative simulation only after a valid ticket is returned; client renders from snapshot
- Token entities spawn with deterministic color per mint address
- Ship-token collision → `collectFromDeposit` mutation validates and marks ticket used, atomically decrements pool, writes persistent `collections` record
- HUD shows per-token-type dot + symbol + count (bottom-right)
- Pool decremented at collection time to prevent over-commitment

### 5. Tokens in Space — Claim
- `SpaceTokenClaim` component reads pending `collections` records from Convex; available on both game over screen and AccountScreen
- Player clicks "Claim all space tokens":
  1. `prepareClaims` Convex action — groups pending collections by deposit, signs `{player, pool, amount, claimId, expiry}` with Convex authority keypair, returns signed claim data
  2. For each claim, client calls `buildClaimTransaction` (spaceVault.ts):
     - Ed25519Program verification instruction
     - `claim` instruction: on-chain program verifies ed25519 sig against `VaultConfig.convexAuthority`, creates `ClaimRecord` PDA (replay protection), transfers tokens from `vaultAta` to player ATA (`init_if_needed`)
  3. Player signs and submits each tx on-chain
  4. `finalizeClaim` mutation marks collections as `claimed`, writes to `claims` table

### 6. Admin Config + Level Progression

- Dev-wallet-gated Admin overlay exposes live game configuration saved through `/admin/config` with `ADMIN_API_KEY`
- Config tab persists economy tiers and gameplay tuning for ship, bullets, asteroids, pickups, ASTRDS pill cadence, and Space Token opportunity cadence/chance
- Level Bands tab persists progression policy bands consumed by the game server
- Bands support asteroid count/speed curves plus ship and powerup budgets over a level range
- Admin can define ranges such as “levels 1–10 have exactly 3 ship pickup opportunities”
- Preview is available as both a table and a chart, showing per-level asteroids, speed, ships, powerups, max lives, ASTRDS tier info, and active Space Token overlays
- Space Token availability in the progression preview is read-only and comes from depositor-authored `minLevel`/`maxLevel` ranges

### 7. Account Screen
- Shows wallet SOL + ASTRDS balances (fetched from chain via `getTokenBalances`)
- Performance stats: total games, best score, average score, play time, leaderboard rank
- Recent games list (last 5)
- Pending space token collections — `SpaceTokenClaim` lets player claim tokens missed on the game over screen
- Space token claims history (last 10 on-chain claims, persistent across all game sessions)
- Player avatar upload (stored in Convex file storage)
- **Tokens tab** — `TokenManager` provides unified token management: view all wallet token accounts (including zero-balance), launch any token into Space (full deposit flow inline), burn balances, close accounts to reclaim rent, batch-close empty accounts

## Functional Requirements

- [x] Wallet auth survives page refresh within session expiry window
- [x] Light/dark theme persists across refresh and applies to both React UI and live canvas gameplay
- [x] ASTRDS mint is server-authoritative — game server writes earned amount via authenticated HTTP; client submits on-chain tx with ed25519 authorization from `prepareMint`
- [x] Space deposit amounts verified on-chain via `tx.meta` — client input not trusted for amounts
- [x] Pool decrement is atomic (Convex serialized mutations) — safe under concurrent players
- [x] Spawn requires server-issued ticket — validates paid session before any pool decrement
- [x] Claims are persistent — pending collections visible on AccountScreen across all games
- [x] Claim replay protection — on-chain `ClaimRecord` PDA prevents double-spend per claim ID
- [x] Webhook handler verifies `Authorization` header before processing
- [x] `reconcileAllPools` cron runs hourly to cap balances to on-chain reality
- [x] External treasury drains detected via webhook outbound check against `claims` table
- [x] Admin config distinguishes live persisted settings from preview data and exposes live ship, bullet, asteroid, pickup, economy, and progression tuning
- [x] Level Bands are persisted in Convex and consumed by the game server for server-authoritative progression
- [x] Admin progression preview supports table/chart views and read-only Space Token availability overlays

## Non-Functional Requirements

- Convex mutations are serialized per document — race conditions on pool decrement are structurally impossible
- Convex authority keypair `CNhWD1cXNaCMcjJmFcK25aFgV3ZTAFtyFDBvGfKZcpzF` signs ed25519 claim + mint authorizations; on-chain program verifies against `VaultConfig.convexAuthority`. Mint authority is held by VaultConfig PDA — direct SPL `mintTo` via keypair is not possible.
- `PROGRAM_AUTHORITY_PRIVATE_KEY` never leaves Convex — never in frontend bundle
- Helius webhook secret (`HELIUS_WEBHOOK_SECRET`) validated server-side on every POST
- Depleted pools remain queryable — needed to serve pending claim payouts

## Nice To Have

- Theme polish: continue tuning individual light/dark image assets and contrast as art direction evolves
- Mobile controls
- Mainnet migration — economy design in progress, see `docs/economy.md`
- Code splitting (bundle currently ~500KB+)
- Error boundary / user-facing error UI for failed score submission or mint
- Surface real $ASTRDS token balance in AccountScreen (currently fetched from chain but `getTokenBalances` util is minimal)
- Show claim status per-token in game over screen (currently shows success/fail for whole batch)

## Known Issues

- Player who collects a space token but closes browser before claiming: pool slot consumed, vault tokens never paid out (accepted limitation)
- Two players simultaneously collecting the last token in a pool: first mutation wins, second player's token vanishes silently (extremely rare edge case, accepted)
- Pre-existing TypeScript strict mode errors in game entities and UI components (implicit `any`)
- `eval` warning from a rollup dependency in the build
- Helius devnet `INITIALIZE_ACCOUNT` transactions have empty `tokenTransfers` in enhanced format — webhook handler falls back to `verifyAndConfirmDeposit` action path in this case
