---
status: current
updated: 2026-04-16
---

# Architecture

## Overview

ASTRDS is a browser-based canvas game built with React/Vite. Players connect a Solana wallet, pay to play via wallet signature, collect $ASTRDS tokens during gameplay, and claim them on game over via on-chain SPL mint. Third parties can deposit any SPL token into the game treasury — those tokens spawn as collectibles in-game and are claimed by players on game over. Backend runs entirely on Convex — reactive DB, serverless actions, real-time queries, and an HTTP router for webhook ingestion.

## Layers

### Frontend (src/)

- **Game engine** — canvas-based, driven by `engineStore.ts`. Entity classes: `Ship`, `Asteroid`, `Bullet`, `Particle`, `Pill`, `Token`, `ShipPickup`. Systems: `ParticleSystem`, collision detection in engine store.
- **Screens** — `title`, `ready`, `game`, `gameover`, `leaderboard`, `account`, `tokenomics`. Managed by `GameStateManager.tsx` which reads the state machine.
- **State** — Zustand stores. `stateMachine.ts` is the source of truth for screen flow. Other stores: `audioStore`, `authStore`, `chatStore`, `engineStore`, `gameData`, `inventoryStore`, `levelStore`, `overlayStore`, `powerupStore`, `spaceTokenStore`.
- **Blockchain** — Solana wallet-adapter (Solana wallet-adapter). Auth via wallet signature verified server-side in Convex. Token minting/transfers via Convex actions calling SPL.
- **Chat** — Reactive via Convex `useQuery(api.chat.getMessages)`. No Pusher.

### State Machine

Five states with validated transitions:

```
INITIAL → READY_TO_PLAY → PLAYING ↔ PAUSED
                                  ↓
                               GAME_OVER → READY_TO_PLAY | INITIAL
```

### Backend (convex/)

All backend logic runs in Convex. No Netlify Functions.

| File | Purpose |
|---|---|
| `sessions.ts` | Verified wallet sessions (internalMutation + query) |
| `verifyPayment.ts` | "use node" action — verifies Solana tx on-chain, creates session |
| `scores.ts` | Top-10 leaderboard (getScores query, submitScore mutation) |
| `gameSessions.ts` | Game session lifecycle (create, update, get) |
| `chat.ts` | Reactive chat — last 100 messages, reactive via useQuery |
| `tokens.ts` | "use node" action — SPL mintTo for ASTRDS via authority keypair |
| `spaceDeposits.ts` | Queries + mutations for space token pools and claims (public + internal) |
| `spaceDepositsActions.ts` | "use node" actions — verify deposit tx, execute claim transfer, reconcile pool |
| `http.ts` | Convex HTTP router — registers `/treasury-webhook` endpoint |
| `webhookHandlers.ts` | `handleTreasuryWebhook` httpAction — processes Helius Enhanced Transaction events |
| `crons.ts` | Scheduled jobs — `reconcileAllPools` runs hourly |
| `devMutations.ts` | Dev-only mutations — seed fake pools, clear deposits (no "use node") |

### Schema — Key Tables

| Table | Purpose |
|---|---|
| `verifiedSessions` | Wallet + tx + expiry for "insert quarter" auth |
| `scores` | All-time top scores (index: `by_score`) |
| `gameSessions` | Per-game session tracking (index: `by_wallet`) |
| `chatMessages` | Last 100 chat messages |
| `players` | Avatar storage IDs per wallet |
| `spaceDeposits` | Token pool records (indexes: `by_wallet`, `by_status`, `by_tx`) |
| `claims` | On-chain claim transfer records (indexes: `by_signature`, `by_deposit`, `by_player_wallet`) |

### Token — ASTRDS

- Mint: `5sqKSHDKZr4KbNzj972PSfmEhtR9eLeBvv1nBRbeQAnB`
- Program: Token-2022 (`TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb`)
- Authority: `CNhWD1cXNaCMcjJmFcK25aFgV3ZTAFtyFDBvGfKZcpzF` (treasury wallet)
- Metadata: name=ASTRDS, symbol=ASTRDS, URI=https://astrds.ndao.computer/token.json
- 9 decimals, 1 token collected in-game = 1 $ASTRDS minted

### Tokens in Space

Any SPL token (Token-2022 or legacy) can be deposited into the game treasury wallet. Deposited tokens spawn as collectibles during gameplay and are claimed by players on game over.

**Deposit flow:**
1. Depositor opens `SendToSpaceOverlay`, configures token + amount + level range + tokensPerPill
2. `registerDepositIntent` mutation creates a `pending_verification` record in Convex (amount = 0, no txSignature yet)
3. Frontend builds SPL transfer tx → player signs → sends on-chain
4. `submitDepositTransaction` mutation attaches the tx signature to the pending record
5. **Parallel paths** — both fire immediately after tx submission:
   - **Helius webhook** → `handleTreasuryWebhook` httpAction finds deposit by txSignature, reads verified token delta, calls `confirmDeposit` → status flips to `active`
   - **`verifyAndConfirmDeposit` action** → reads `tx.meta.postTokenBalances - preTokenBalances` directly from RPC, calls `confirmDeposit`
6. Overlay subscribes reactively to deposit status via `getDepositById` query and advances to done automatically
7. If neither fires within 45s, a "Verify Manually" button surfaces as last resort

**Amount verification — the on-chain source of truth:**
- `totalAmount` stored in Convex is **never taken from client input**
- `parseTreasuryTokenDelta`: derives treasury ATAs for both TOKEN_2022 and TOKEN programs, matches by `accountIndex` in `tx.meta` — never relies on optional `owner` field
- Depositors cannot inflate pool amounts regardless of what they submit

**Webhook security:**
- All POSTs to `/treasury-webhook` must carry `Authorization: <HELIUS_WEBHOOK_SECRET>`
- Outbound transfers checked against `claims` table — unknown outbound triggers `reconcilePool` action
- `reconcileAllPools` cron runs hourly as devnet fallback (Helius doesn't reliably fire on devnet)

**Collection flow:**
1. `engineStore.spawnToken()` checks eligible pools for current level; 25% chance to spawn a space token (100% in dev fast-spawn mode)
2. Token entity rendered with deterministic color from `src/lib/tokenColors.ts` (hash of mint address → stable palette index)
3. Ship-token collision → `collectFromDeposit` mutation called fire-and-forget; atomically decrements `remainingAmount`. Convex serializes mutations — race-safe across players.
4. On `success: true`, `spaceTokenStore.recordCollection()` updates local HUD state
5. HUD (bottom-right) shows per-type dot + symbol + count for all collected space tokens

**Claim flow (game over):**
1. `SpaceTokenClaim` component reads `spaceTokenStore.collections`, groups by mint, shows totals
2. Player clicks claim → `claimSpaceTokens` Convex action runs server-side:
   - Dev deposits (txSignature starts with `dev-seed-`) → skip on-chain, return success
   - Real deposits → probe treasury ATA under TOKEN_2022 then TOKEN program to find which holds balance
   - Final balance check — returns `success: false` gracefully if treasury is empty (stale deposit)
   - Builds transfer tx: create player ATA (idempotent) + transfer claimable amount
   - Signs and sends via authority keypair
   - Calls `recordClaim` mutation to store the tx signature in `claims` table
3. AccountScreen shows persistent claim history via `getClaimsByWallet` query (last 10, sorted by date)

**Race condition handling:**
- Pool is decremented at collection time (not claim time) — prevents over-commitment with multiple concurrent players
- `collectFromDeposit` is a Convex mutation (serialized) — no two players can take the same slot
- `depleted` status means `remainingAmount < tokensPerPill` — not all tokens paid out yet (players who collected still need to claim)
- Known limitation: player who collects but never claims → pool slot consumed, tokens never paid out

**Token colors:**
- `src/lib/tokenColors.ts` — `getTokenColor(mintAddress)` hashes mint address to one of 10 palette colors
- `ASTRDS_COLOR = '#FF642D'` — used for standard ASTRDS tokens (not from space pools)
- Colors are stable: same mint always gets same color across sessions and players

## Data Flow (typical game)

1. Wallet connects → `authStore` updates → title screen unlocks
2. "Insert Quarter" → wallet signs tx → `verifyPayment` action verifies on-chain → session stored in Convex → `INITIAL → READY_TO_PLAY`
3. Game starts → `gameSessions.create` → `READY_TO_PLAY → PLAYING`; `SpacePoolSync` mounts, polls active deposits into `spaceTokenStore`
4. Gameplay → score increments in `gameData`; ASTRDS tokens increment `inventoryStore`; space tokens collected → `collectFromDeposit` mutation + `spaceTokenStore` update; HUD reflects both
5. Death → `PLAYING → GAME_OVER` → `endGameSession` submits score; `ASTRDSMinting` claims ASTRDS; `SpaceTokenClaim` shows mined space tokens
6. ASTRDS claim → `mintTokens` action calls SPL `mintTo`
7. Space token claim → `claimSpaceTokens` action transfers from treasury ATA to player ATA → `recordClaim` persists to `claims` table
8. AccountScreen → `getClaimsByWallet` query returns all historical claims joined with deposit metadata (symbol, decimals, logoUri)

## Key Config

- `netlify.toml` — static build only, no functions
- `vite.config.ts` — Vite/React build
- `convex/schema.ts` — DB tables: verifiedSessions, scores, gameSessions, chatMessages, players, spaceDeposits, claims
- `VITE_CONVEX_URL` — Convex deployment URL (frontend)
- `VITE_HELIUS_API_KEY` — Helius API key (network hardcoded in `src/lib/solana.ts`)
- `PROGRAM_AUTHORITY_PRIVATE_KEY` — SPL authority keypair JSON array (Convex env, never in frontend)
- `SOLANA_RPC_ENDPOINT` — RPC used by Convex actions (Convex env)
- `HELIUS_WEBHOOK_SECRET` — shared secret for webhook auth (Convex env)

## Dev Tooling

`src/components/dev/DevTools.tsx` — visible in DEV builds only, bottom-left corner.

- **Mint Test Token** — select from `TEST_TOKENS` list, mint to connected wallet via `devTools.mintTestToken`
- **Mint All** — mint all test tokens at once
- **Seed All Pools** — insert fake `spaceDeposits` records for all test tokens (no on-chain tx; bypasses on-chain in claim)
- **Clear Dev** — delete only dev-seeded deposits
- **Clear All** — delete all deposits
- **Kill Ship** — destroy ship entity, triggers game over
- **Fast Spawn** — collapses token spawn delay to 500ms, always picks space token when pools exist

Fake deposit signatures start with `dev-seed-` — `claimSpaceTokens` detects this and skips on-chain entirely. `reconcileAllPools` also skips dev-seeded deposits when checking on-chain balances.

## Out of Scope (currently)

- Mobile controls
- Mainnet deployment
- Achievement system
