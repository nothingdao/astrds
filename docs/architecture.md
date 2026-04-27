---
status: current
updated: 2026-04-26
---

# Architecture

## Overview

ASTRDS is a browser-based canvas game built with React/Vite. Players connect a Solana wallet, pay to play via wallet signature, collect $ASTRDS tokens during gameplay, and claim them on game over via on-chain SPL mint. Third parties can deposit any SPL token into the game treasury — those tokens spawn as collectibles in-game and are claimed by players via on-chain vault instructions. Backend runs entirely on Convex — reactive DB, serverless actions, real-time queries, and an HTTP router for webhook ingestion.

## Layers

### Frontend (src/)

- **Game engine** — canvas-based renderer. `GameScreen` delegates unconditionally to `ServerGameScreen`, which receives `GameSnapshot` over WebSocket and calls `renderServerSnapshot`. Entity classes (`Ship`, `Asteroid`, `Bullet`, `Particle`, `Pill`, `Token`, `ShipPickup`) have separated `update(dt, screen)` (physics) and `render(ctx)` (canvas) methods, enabling the simulation to run in Node without browser APIs.
- **Design/theme system** — shadcn-compatible CSS variables in `src/styles/style.css` are the source of truth. `themeStore.ts` persists `dark` / `light`; `ThemeController` applies `theme-dark` / `theme-light` to `document.documentElement`; `ThemeToggle` lives in the Header. React UI uses semantic Tailwind classes (`bg-background`, `text-foreground`, `bg-card`, `text-muted-foreground`, `text-tx-*`, `bg-surface-*`, `border-edge-*`). Canvas rendering cannot use Tailwind, so `src/lib/designTokens.ts` reads and caches CSS vars for renderers. `resolveCanvasColor` maps historical server snapshot colors (e.g. `#fff`) to current theme tokens so active gameplay remains visible in both themes.
- **Themed screen art** — `ScreenContainer.tsx` selects per-theme image assets for `INITIAL`, `READY_TO_PLAY`, and `GAME_OVER` (`title-dark/light`, `ready-dark/light`, `end-game-dark/light`). Title and game-over screens use fullscreen backgrounds; content panels supply their own readability overlays.
- **Screens** — `title`, `ready`, `game`, `gameover`, `leaderboard`, `account`, `tokenomics`. Managed by `GameStateManager.tsx` which reads the state machine.
- **State** — Zustand stores. `stateMachine.ts` is the source of truth for screen flow. Other stores: `audioStore`, `authStore`, `chatStore`, `engineStore`, `gameData`, `inventoryStore`, `levelStore`, `overlayStore`, `powerupStore`, `spaceTokenStore`. Stores are hydrated from `GameSnapshot` on each server tick.
- **Blockchain** — Solana wallet-adapter. Auth via wallet signature verified server-side in Convex. Space token claims and ASTRDS minting both via on-chain vault program instructions (`spaceVault.ts`). Wallet connect dialog is a custom component (`GameWalletModal.tsx`) — does not use the library's default modal.
- **Chat** — Reactive via Convex `useQuery(api.chat.getMessages)`. No Pusher.

### Game Server (server/)

Required Node.js WebSocket server that owns the authoritative game loop. The client is a pure renderer — `GameScreen` always delegates to `ServerGameScreen`.

- **`server/src/index.ts`** — HTTP health check + WebSocket upgrade, one `SessionHandler` per connection
- **`server/src/ws/SessionHandler.ts`** — 30 tick/s `setInterval` loop; handles `hello`, `resize`, `input`, `pause`, `resume`, `reset`, `ping` messages; sends `welcome`, `state`, `gameOver` snapshots
- **`server/src/game/GameSession.ts`** — thin wrapper around `shared/game/simulation.ts`; exposes `snapshot()`, `update()`, `resize()`, `reset()`
- **`shared/game/simulation.ts`** — authoritative physics: no React, canvas, Zustand, Convex, or browser APIs; safe to run in Node or browser
- **`shared/game/protocol.ts`** — `ClientToServerMessage`, `ServerToClientMessage`, `GameSnapshot`, `InputState` types shared across client and server

Running the game server locally:

```bash
cd server && pnpm install && pnpm dev   # default port 3001
# then in app/.env.local:
# VITE_WS_URL=ws://localhost:3001
```

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
| `prices.ts` | SOL/USD price feed — server-side Convex action; tries Coinbase → Binance → CoinGecko to avoid browser CORS/fallback pricing issues |
| `economySnapshots.ts` | Periodic snapshots of live economic state (pool price, tier, circulating supply) |
| `admin.ts` | Admin-gated mutations for operator tooling |
| `spaceDeposits.ts` | Queries + mutations for space token pools, spawn tickets, collections, and claims |
| `spaceDepositsActions.ts` | "use node" actions — verify deposit tx, prepare ed25519 claim authorizations, reconcile pools |
| `http.ts` | Convex HTTP router — registers `/treasury-webhook` endpoint |
| `webhookHandlers.ts` | `handleTreasuryWebhook` httpAction — processes Helius Enhanced Transaction events |
| `crons.ts` | Scheduled jobs — `reconcileAllPools` runs hourly |
| `devTools.ts` | "use node" action — mint real devnet SPL tokens to a wallet (deterministic keypair per tokenDir) |
| `vaultHealth.ts` | "use node" actions — enumerate on-chain DepositPool PDAs, cross-ref Convex, sync missing records |

### Schema — Key Tables

| Table | Purpose |
|---|---|
| `verifiedSessions` | Wallet + tx + expiry for "insert quarter" auth |
| `scores` | All-time top scores (index: `by_score`) |
| `gameSessions` | Per-game session tracking (index: `by_wallet`) |
| `chatMessages` | Last 100 chat messages |
| `players` | Avatar storage IDs per wallet |
| `spaceDeposits` | Token pool records (indexes: `by_wallet`, `by_wallet_mint`, `by_status`, `by_tx`) |
| `spawnTickets` | Server-issued one-time spawn authorizations — validates player session before pool decrement |
| `collections` | Individual pill collection events, persistent across sessions (index: `by_status_wallet`) |
| `claims` | On-chain claim transfer records (indexes: `by_signature`, `by_deposit`, `by_player_wallet`) |
| `economySnapshots` | Shared economy history snapshots for price chart / supply visualization |

### Token — ASTRDS

- Mint: `5sqKSHDKZr4KbNzj972PSfmEhtR9eLeBvv1nBRbeQAnB`
- Program: Token-2022 (`TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb`)
- Authority: `CNhWD1cXNaCMcjJmFcK25aFgV3ZTAFtyFDBvGfKZcpzF` (treasury / Convex authority wallet)
- Metadata: name=ASTRDS, symbol=ASTRDS, URI=https://astrds.ndao.computer/token.json
- 9 decimals, 1 token collected in-game = 1 $ASTRDS minted

### Tokens in Space

Any SPL token (Token-2022 or legacy) can be deposited into the on-chain vault. Deposited tokens spawn as collectibles during gameplay and are claimed by players via on-chain vault instructions.

**Deposit flow:**
1. Depositor opens `SendToSpaceOverlay`, configures token + amount + level range + tokensPerPill
2. `registerDepositIntent` mutation creates a `pending_verification` record in Convex
3. Frontend calls `buildSendToSpaceTransaction` (spaceVault.ts) — builds `registerPool` + `deposit` instructions (registerPool only if pool PDA doesn't yet exist)
4. Player signs and sends on-chain → tokens land in DepositPool PDA's `vaultAta` (not treasury wallet)
5. `confirmDepositFromChain` mutation sets pool address and activates the record
6. `verifyAndConfirmDeposit` action runs in parallel — reads `tx.meta.postTokenBalances - preTokenBalances` directly from RPC and overwrites Convex amount with verified on-chain value

**Amount verification — the on-chain source of truth:**
- `parseTreasuryTokenDelta` reads the actual on-chain transfer delta from `tx.meta` — client cannot inflate amounts
- The on-chain `DepositPool` PDA also tracks `remaining` — `reconcileAllPools` caps Convex balances to on-chain reality hourly

**Webhook security:**
- All POSTs to `/treasury-webhook` must carry `Authorization: <HELIUS_WEBHOOK_SECRET>`
- Outbound transfers checked against `claims` table — unknown outbound triggers `reconcilePool` action
- `reconcileAllPools` cron runs hourly as devnet fallback

**Spawn flow:**
1. Game server checks eligible pools for the current level and calls `requestSpawnTicket` (Convex mutation) — validates player has an active paid session, checks per-player cooldown, issues a one-time `spawnTickets` record
2. If valid ticket returned → game server injects a `Token` entity into the authoritative simulation; snapshot is sent to client for rendering
3. Token entity rendered with deterministic color from `src/lib/tokenColors.ts`
4. Ship-token collision (server-authoritative) → `collectFromDeposit` mutation validates the ticket, marks it used, atomically decrements `remainingAmount`, and writes a persistent `collections` record
5. HUD (bottom-right) shows per-type dot + symbol + count for all collected space tokens

**Claim flow:**
1. `SpaceTokenClaim` component reads pending `collections` records from Convex, groups by mint, shows totals
2. Player clicks claim → `prepareClaims` Convex action:
   - Fetches pending collections grouped by deposit
   - Signs a claim authorization message `{player, pool, amount, claimId, expiry}` with Convex authority keypair
   - Returns signed claim data to the client
3. Client calls `buildClaimTransaction` (spaceVault.ts) per claim:
   - Adds Ed25519Program verification instruction
   - Adds `claim` instruction — on-chain program verifies ed25519 signature, creates `ClaimRecord` PDA (replay protection), transfers tokens from `vaultAta` to player ATA
4. Player signs and submits on-chain
5. `finalizeClaim` mutation marks collections as `claimed` and writes to `claims` table
6. `SpaceTokenClaim` is also available on AccountScreen — pending collections persist across sessions

**Race condition handling:**
- Pool is decremented at collection time via a server-issued ticket — prevents over-commitment with multiple concurrent players
- `collectFromDeposit` is a Convex mutation (serialized) — no two players can take the same slot
- `depleted` status means `remainingAmount < tokensPerPill` — players who collected can still claim their share

**Token colors:**
- `src/lib/tokenColors.ts` — `getTokenColor(mintAddress)` hashes mint address to one of 10 CSS-variable-backed palette slots (`--space-token-0` … `--space-token-9`)
- `getAstrdsColor()` reads `--canvas-token` for standard ASTRDS tokens (not from space pools)
- Colors are stable by mint address, but the actual rendered values can differ by theme for contrast
- The server/shared simulation may still emit historical protocol hex colors; the client resolves those via `resolveCanvasColor` before rendering

## Data Flow (typical game)

1. Wallet connects → `authStore` updates → title screen unlocks
2. "Insert Quarter" → wallet signs tx → `verifyPayment` action verifies on-chain → session stored in Convex → `INITIAL → READY_TO_PLAY`
3. Game starts → `gameSessions.create` → `READY_TO_PLAY → PLAYING`; `SpacePoolSync` mounts, polls active deposits into `spaceTokenStore`
4. Gameplay → score increments in `gameData`; ASTRDS tokens increment `inventoryStore`; space tokens collected → `requestSpawnTicket` → `collectFromDeposit` (atomic decrement + persistent collection record) + `spaceTokenStore` update; HUD reflects both
5. Death → `PLAYING → GAME_OVER` → `endGameSession` submits score; `ASTRDSMinting` claims ASTRDS; `SpaceTokenClaim` shows pending collections
6. ASTRDS claim → `prepareMint` action signs ed25519 authorization → client builds + submits on-chain `mint_astrds` instruction → VaultConfig PDA CPIs `mintTo` → `MintRecord` PDA created for replay protection
7. Space token claim → `prepareClaims` issues ed25519 authorization → client builds + submits on-chain `claim` instruction → vault transfers tokens to player → `finalizeClaim` persists to `claims` table
8. AccountScreen → `getClaimsByWallet` query returns all historical claims; `SpaceTokenClaim` shows any still-unclaimed collections; `TokenManager` (Tokens tab) lets player launch tokens into Space or burn + close unwanted token accounts

## Key Config

- `netlify.toml` — static build only, no functions
- `vite.config.ts` — Vite/React build
- `convex/schema.ts` — DB tables: verifiedSessions, scores, gameSessions, chatMessages, players, spaceDeposits, spawnTickets, collections, claims
- `VITE_CONVEX_URL` — Convex deployment URL (frontend)
- `VITE_HELIUS_API_KEY` — Helius API key (network hardcoded in `src/lib/solana.ts`)
- `VITE_WS_URL` — WebSocket server URL (e.g. `ws://localhost:3001` for local dev, Railway URL for prod); game server is required
- `PROGRAM_AUTHORITY_PRIVATE_KEY` — SPL authority keypair JSON array (Convex env, never in frontend)
- `SOLANA_RPC_ENDPOINT` — RPC used by Convex actions (Convex env)
- `HELIUS_WEBHOOK_SECRET` — shared secret for webhook auth (Convex env)

## Dev Tooling

`src/components/dev/DevTools.tsx` — visible in DEV builds only, accessible via the `[DEV]` tab in the overlay.

- **Mint Test Token** — select from `TEST_TOKENS` list, mint to connected wallet via `devTools.mintTestToken` (deterministic keypair per tokenDir — same token address on repeat calls)
- **Mint All** — mint all test tokens at once
- **Fast Spawn** — collapses token spawn delay to 500ms, always picks space token when pools exist
- **Kill Ship** — destroy ship entity, triggers game over
- **Vault Health Check** — enumerate all on-chain DepositPool PDAs, cross-reference Convex records, sync missing pools back into Convex

`src/utils/walletTokens.ts` — `getWalletTokens(address, includeEmpty)` fetches all SPL token accounts (TOKEN + TOKEN_2022) for a wallet, enriched with Helius DAS metadata. Used by `TokenManager`.

`src/components/account/TokenManager.tsx` — unified token management in the Account screen's Tokens tab. Lists all wallet token accounts (including zero-balance), supports launching tokens into Space (full deposit flow inline) and burning balances + closing accounts to reclaim rent. Batch-closes empty accounts via `signAllTransactions`.

## Out of Scope (currently)

- Mobile controls
- Mainnet deployment
- Achievement system
