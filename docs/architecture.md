---
status: current
updated: 2026-04-29
---

# Architecture

## Overview

ASTRDS is a browser-based canvas game built with React/Vite. Players connect a Solana wallet, pay to play via wallet signature, collect $ASTRDS tokens during gameplay, and claim them on game over via on-chain SPL mint. Third parties can deposit any SPL token into the game treasury — those tokens spawn as collectibles in-game and are claimed by players via on-chain vault instructions. Backend runs entirely on Convex — reactive DB, serverless actions, real-time queries, and an HTTP router for webhook ingestion.

## Layers

### Frontend (src/)

- **Game engine** — canvas-based renderer. `GameScreen` delegates unconditionally to `ServerGameScreen`, which receives `GameSnapshot` over WebSocket and calls `renderServerSnapshot`. Entity classes (`Ship`, `Asteroid`, `Bullet`, `Particle`, `Pill`, `Token`, `ShipPickup`) have separated `update(dt, screen)` (physics) and `render(ctx)` (canvas) methods, enabling the simulation to run in Node without browser APIs. Authoritative physics and gameplay rules live in `shared/game/simulation.ts`; per-level progression policies are resolved in `shared/game/progression.ts`.
- **Design/theme system** — shadcn-compatible CSS variables in `src/styles/style.css` are the source of truth. `themeStore.ts` persists `dark` / `light`; `ThemeController` applies `theme-dark` / `theme-light` to `document.documentElement`; `ThemeToggle` lives in the Header. React UI uses semantic Tailwind classes (`bg-background`, `text-foreground`, `bg-card`, `text-muted-foreground`, `text-tx-*`, `bg-surface-*`, `border-edge-*`). Canvas rendering cannot use Tailwind, so `src/lib/designTokens.ts` reads and caches CSS vars for renderers. `resolveCanvasColor` maps historical server snapshot colors (e.g. `#fff`) to current theme tokens so active gameplay remains visible in both themes.
- **Themed screen art** — `ScreenContainer.tsx` selects per-theme image assets for `INITIAL`, `READY_TO_PLAY`, and `GAME_OVER` (`title-dark/light`, `ready-dark/light`, `end-game-dark/light`). Title and game-over screens use fullscreen backgrounds; content panels supply their own readability overlays.
- **Screens** — `title`, `ready`, `game`, `gameover`, `leaderboard`, `account`, `tokenomics`. Managed by `GameStateManager.tsx` which reads the state machine.
- **State** — Zustand stores. `stateMachine.ts` is the source of truth for screen flow. Other stores: `audioStore`, `chatStore`, `engineStore`, `gameData`, `inventoryStore`, `levelStore`, `overlayStore`, `powerupStore`, `serverStore`, `settingsPanelStore`, `spaceTokenStore`, `themeStore`. Stores are hydrated from `GameSnapshot` on each server tick.
- **Blockchain** — Solana wallet-adapter. Auth via wallet signature verified server-side in Convex. Space token claims and ASTRDS minting both via on-chain vault program instructions (`spaceVault.ts`). Wallet connect dialog is a custom component (`GameWalletModal.tsx`) — does not use the library's default modal.
- **Chat** — Reactive via Convex `useQuery(api.chat.getMessages)`. No Pusher.

### Game Server (server/)

Required Node.js WebSocket server that owns the authoritative game loop. The client is a pure renderer — `GameScreen` always delegates to `ServerGameScreen`.

- **`server/src/index.ts`** — HTTP health check + WebSocket upgrade, one `SessionHandler` per connection
- **`server/src/ws/SessionHandler.ts`** — 30 tick/s `setInterval` loop; handles `hello`, `resize`, `input`, `pause`, `resume`, `reset`, `ping` messages; sends `welcome`, `state`, `gameOver` snapshots. On `hello`, it verifies/consumes the paid session, refreshes Convex admin config, applies it to the simulation, then fetches and locks the emission tier.
- **`server/src/game/GameSession.ts`** — thin wrapper around `shared/game/simulation.ts`; exposes `snapshot()`, `update()`, `resize()`, `reset()`
- **`shared/game/simulation.ts`** — authoritative physics: no React, canvas, Zustand, Convex, or browser APIs; safe to run in Node or browser. Consumes `SimulationConfig` for ship, bullet, asteroid, pickup, and progression behavior.
- **`shared/game/progression.ts`** — shared progression policy resolver. Supports curve modes (`fixed`, `linear`, `step`, `randomRange`) and budget distributions (`even`, `random`, `early`, `late`, `manual`) for level-band previews and server enforcement.
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
| `tokens.ts` | "use node" actions — `prepareMint` signs ed25519 mint authorization; `mintTokens` is deprecated (mint authority transferred to VaultConfig PDA) |
| `prices.ts` | SOL/USD price feed — server-side Convex action; tries Coinbase → Binance → CoinGecko to avoid browser CORS/fallback pricing issues |
| `economySnapshots.ts` | Periodic snapshots of live economic state (pool price, tier, circulating supply) |
| `admin.ts` | Admin config query + authenticated HTTP update path for live game tuning, economy tiers, and progression bands |
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
| `gameConfig` | Singleton admin config: economy tiers, gameplay tuning constants, `applyToRunning`, and persisted progression bands |
| `economySnapshots` | Shared economy history snapshots for price chart / supply visualization |

### Token — ASTRDS

- Mint: `5sqKSHDKZr4KbNzj972PSfmEhtR9eLeBvv1nBRbeQAnB` (Token-2022)
- **Mint authority**: VaultConfig PDA `6zsWYibNCYYQJikHv8BHXRNynEACgFKsZPNXqWqBPbvv` — minting only possible via on-chain `mint_astrds` instruction; no direct keypair mintTo
- **Ed25519 signing authority**: Convex keypair `CNhWD1cXNaCMcjJmFcK25aFgV3ZTAFtyFDBvGfKZcpzF` — signs `prepareMint` and `prepareClaims` authorizations; verified on-chain against `VaultConfig.convexAuthority`
- **Freeze authority**: Convex keypair `CNhWD1cXNaCMcjJmFcK25aFgV3ZTAFtyFDBvGfKZcpzF`
- 9 decimals; max 50 ASTRDS earned per game (emission tiers, see `docs/economy.md`); uncollected pills burned

See `docs/chain.md` for full address table and PDA seeds.

### Tokens in Space

Any SPL token (Token-2022 or legacy) can be deposited into the on-chain vault via `SendToSpaceOverlay`. Tokens land in a `DepositPool` PDA's `vaultAta` — not the treasury wallet. Deposit amounts are verified by reading `tx.meta` directly from RPC; client-supplied amounts are never trusted. The Helius webhook auto-activates deposits; `reconcileAllPools` cron reconciles balances hourly.

During gameplay, the game server issues `spawnTickets` (Convex mutation) gated on active paid session + cooldown. Ship-token collision triggers `collectFromDeposit` (serialized Convex mutation) which atomically decrements the pool and writes a persistent `collections` record. At claim time, `prepareClaims` signs an ed25519 authorization; the client submits a `claim` instruction that creates a `ClaimRecord` PDA for replay protection and transfers tokens from `vaultAta` to the player's ATA.

See `docs/chain.md` for the full deposit → spawn → collect → claim flow diagrams, PDA seeds, and on-chain mechanics.

## Data Flow (typical game)

1. Wallet connects → wallet-adapter state updates → title screen unlocks
2. "Insert Quarter" → wallet signs tx → `verifyPayment` action verifies on-chain → session stored in Convex → `INITIAL → READY_TO_PLAY`
3. Game starts → `gameSessions.create` → `READY_TO_PLAY → PLAYING`; the browser opens the WebSocket and sends `hello` with the Convex game session binding
4. Game server verifies/consumes the paid session, refreshes admin config, applies progression settings, locks emission tier, and periodically refreshes eligible Space Token pools for the current level
5. Gameplay → server simulation updates score/level/pills/tokens; ASTRDS pills increment server-side counters; Space Token spawn opportunities go through `requestSpawnTicket`; ship-token collision triggers `collectFromDeposit` (atomic decrement + persistent collection record); snapshots hydrate client HUD/stores
6. Death → `PLAYING → GAME_OVER` → game server submits authoritative score/level/pills and ASTRDS earned/burned accounting; `ASTRDSMinting` claims ASTRDS; `SpaceTokenClaim` shows pending collections
7. ASTRDS claim → `prepareMint` action signs ed25519 authorization → client builds + submits on-chain `mint_astrds` instruction → VaultConfig PDA CPIs `mintTo` → `MintRecord` PDA created for replay protection
8. Space token claim → `prepareClaims` issues ed25519 authorization → client builds + submits on-chain `claim` instruction → vault transfers tokens to player → `finalizeClaim` persists to `claims` table
9. AccountScreen → `getClaimsByWallet` query returns all historical claims; `SpaceTokenClaim` shows any still-unclaimed collections; `TokenManager` (Tokens tab) lets player launch tokens into Space or burn + close unwanted token accounts

## Key Config

- `netlify.toml` — static build only, no functions
- `vite.config.ts` — Vite/React build
- `convex/schema.ts` — DB tables: verifiedSessions, scores, gameSessions, chatMessages, players, spaceDeposits, spawnTickets, collections, claims, gameConfig, economySnapshots
- `convex/admin.ts` + `/admin/config` — admin config read/write path. Frontend saves require `ADMIN_API_KEY`; game server consumes via `admin:getGameConfig`.

See `README.md` for the full env var reference (frontend, Convex, and game server).

## Admin Config + Progression

`src/screens/admin/AdminScreen.tsx` is dev-wallet-gated and exposes live Convex-backed configuration. Saving uses the Convex HTTP endpoint `/admin/config` with `ADMIN_API_KEY`; the same payload is read by the game server through `admin:getGameConfig`.

Live global tuning includes:

- quarter price and ASTRDS emission tier arrays
- `applyToRunning` for mid-session config adoption
- ship tuning: starting/max lives, radius, rotation, acceleration, inertia, respawn invulnerability
- bullet tuning: speeds, fire delays, radii, rapid-fire power, collision padding
- asteroid tuning: size radii, velocity range, score by size
- pickup tuning: ASTRDS pill interval, Space Token opportunity interval/chance, TTL/radii, powerup duration and on-screen caps

`src/screens/admin/LevelBandEditor.tsx` edits persisted progression bands. Bands define policies over level ranges rather than only fixed values: asteroid count/speed curves, ship pickup budgets, powerup budgets, and max-life caps. The preview can be viewed as a table or left-to-right chart. Space Token availability in the preview is read-only and comes from active `spaceDeposits.minLevel/maxLevel`, because depositors own those ranges.

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
