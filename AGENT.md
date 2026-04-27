# astrds — Agent Context

## What This Project Is

ASTRDS is a browser-based Asteroids game built with React/Vite. Players connect a Solana wallet, pay ~$0.25 SOL to play ("insert quarter"), collect $ASTRDS tokens during gameplay, and claim them on-chain at game over. Third parties can deposit any SPL token into the on-chain vault — those tokens spawn as in-game collectibles claimed via ed25519-signed vault instructions. Scores and chat persist via Convex.

Currently on **devnet**. Mainnet economy design is in progress — see `docs/economy.md`.

## Repo Structure

Anchor monorepo:

```
/
  programs/space-vault-program/src/lib.rs   — on-chain vault (Rust/Anchor)
  tests/                                    — Anchor test suite
  scripts/                                  — one-off admin/devnet scripts
  app/
    src/                                    — React frontend
    convex/                                 — Convex backend functions
    public/                                 — static assets, token metadata, sounds
  server/
    src/index.ts                            — WebSocket game server (Node, ws)
    src/ws/SessionHandler.ts               — per-connection game loop + message handler
    src/game/GameSession.ts                — wraps simulation, exposes snapshot/update/resize
    src/game/gameConfig.ts                 — GameConfig type + defaults (synced from Convex)
    src/game/emissionTiers.ts             — reads Meteora pool price, derives emission tier
    src/convex/client.ts                  — server-side Convex queries (sessions, config, pools)
  shared/
    game/protocol.ts                        — ClientToServerMessage / ServerToClientMessage / GameSnapshot types
    game/simulation.ts                      — authoritative game logic (no browser APIs)
```

## Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS
- **State**: Zustand (13 stores + typed state machine)
- **Blockchain**: Solana web3.js, wallet-adapter, SPL Token (Token-2022 + legacy), Anchor 0.32.1
- **Backend**: Convex (reactive DB, serverless actions, real-time queries, HTTP router)
- **Game server**: Node.js WebSocket server (`server/`) — authoritative loop at 30 tick/s; client is renderer only; deployed to Railway
- **Webhooks**: Helius Enhanced Transactions (watches Space Vault Program ID)
- **Package manager**: pnpm (app/, server/), npm (Anchor root)

## Running Locally

```bash
cd app && pnpm install
pnpm dev      # Vite + Convex concurrently
pnpm start    # Vite only
```

Game server (required — deployed to Railway for prod; run locally for dev):

```bash
cd server && pnpm install
pnpm dev      # tsx watch, default port 3001
```

Env vars in `app/.env.local`:
- `VITE_CONVEX_URL`
- `VITE_HELIUS_API_KEY`
- `VITE_WS_URL` — WebSocket server URL (default: `ws://localhost:3001`); `GameScreen` always delegates to `ServerGameScreen`

Convex env vars (dashboard or `npx convex env set`):
- `PROGRAM_AUTHORITY_PRIVATE_KEY` — Convex authority keypair (`CNhWD1cXNaCMcjJmFcK25aFgV3ZTAFtyFDBvGfKZcpzF`); signs ed25519 authorizations for `mint_astrds` and `claim` instructions. No longer holds ASTRDS mint authority (transferred to VaultConfig PDA).
- `SOLANA_RPC_ENDPOINT`
- `HELIUS_WEBHOOK_SECRET`
- `ADMIN_API_KEY` — optional; for HTTP admin endpoint only

## Key Files

```
app/src/App.tsx                                       — root: wallet providers, theme init, audio init, layout
app/src/stores/stateMachine.ts                        — game state machine (5 states, validated transitions)
app/src/stores/gameData.ts                            — score, session lifecycle
app/src/stores/spaceTokenStore.ts                     — collected space tokens, claim state
app/src/stores/themeStore.ts                          — light/dark theme, persisted to localStorage
app/src/config/devWallets.ts                          — DEV_WALLETS set + isDevWallet(); controls Admin tab visibility
app/src/lib/designTokens.ts                           — reads CSS variables at runtime for theme-aware canvas rendering
app/src/lib/spaceVault.ts                             — on-chain tx builders: deposit, claim, game payment, crank liquidity, mint_astrds
app/src/lib/tokenColors.ts                            — deterministic color per mint address (theme-aware)
app/src/lib/tokenomics.ts                             — Meteora pool snapshot, SOL/USD price, emission tier lookup
app/src/game/                                         — entity classes (Ship, Asteroid, Bullet, Pill, Token, etc.)
app/src/screens/                                      — screen components
app/src/screens/game/ServerGameScreen.tsx             — WebSocket client; renders snapshots, sends input, hydrates stores
app/src/screens/game/components/GameStateManager.tsx  — drives screen routing from state machine
app/src/screens/admin/AdminScreen.tsx                 — admin panel: game config, emission tiers, quarter price (dev wallets only)
app/src/screens/help/HelpScreen.tsx                   — Help overlay with Keyboard sub-tab
app/src/components/overlay/OverlayManager.tsx         — tab bar: appends Admin tab for dev wallets
app/src/components/space/SendToSpaceOverlay.tsx       — deposit flow UI (pick → configure → send → confirm)
app/src/components/tokens/ASTRDSMinting.tsx           — claim UI: prepareMint → wallet tx → on-chain mint_astrds
app/src/components/account/TokenManager.tsx           — unified token management: launch into Space + burn/close accounts
app/src/components/wallet/GameWalletModal.tsx         — custom styled wallet connect dialog (replaces library modal)
app/src/screens/gameover/SpaceTokenClaim.tsx          — space token claim UI (also used in AccountScreen)
app/src/utils/walletTokens.ts                         — fetch all SPL token accounts for a wallet + DAS metadata
app/convex/schema.ts                                  — DB tables: verifiedSessions, scores, gameSessions, chatMessages, players, spaceDeposits, spawnTickets, collections, claims, gameConfig, economySnapshots
app/convex/admin.ts                                   — getGameConfig query + setGameConfig mutation (dev wallet gated) + HTTP endpoint
app/convex/tokens.ts                                  — prepareMint action (signs ed25519 mint auth); mintTokens kept but deprecated post-authority-transfer
app/convex/spaceDeposits.ts                           — queries + mutations for pools, spawn tickets, collections, claims
app/convex/spaceDepositsActions.ts                    — "use node" actions: verify deposit, prepareClaims (ed25519), reconcile pools
app/convex/prices.ts                                  — SOL/USD price feed from Jupiter API (cached)
app/convex/economySnapshots.ts                        — periodic snapshots of live economic state
app/convex/devTools.ts                                — mint real devnet tokens (deterministic keypair per tokenDir)
app/convex/vaultHealth.ts                             — enumerate on-chain DepositPool PDAs, sync to Convex
app/convex/http.ts                                    — HTTP router: /treasury-webhook (watches Space Vault Program ID)
app/convex/webhookHandlers.ts                         — Helius webhook: activate pending deposits, reconcile pools on drain
app/convex/crons.ts                                   — hourly reconcileAllPools cron
programs/space-vault-program/src/lib.rs               — on-chain vault: deposits, claims, game payments, revenue split, mint_astrds, crank_liquidity
server/src/index.ts                                   — WebSocket server: HTTP health check + ws upgrade
server/src/ws/SessionHandler.ts                       — per-connection 30 tick/s loop, pause/resume, message routing
server/src/game/GameSession.ts                        — wraps simulation; exposes snapshot(), update(), resize(), reset()
server/src/game/gameConfig.ts                         — GameConfig type; defaults; polled from Convex every 10s
server/src/game/emissionTiers.ts                      — fetches Meteora pool price, derives tier from config breakpoints
server/src/convex/client.ts                           — ConvexServerClient: session verify, config, pools, game session updates
shared/game/protocol.ts                               — shared message + snapshot types
shared/game/simulation.ts                             — authoritative physics simulation (no browser/React/Convex deps)
```

## State Machine

```
INITIAL → READY_TO_PLAY → PLAYING ↔ PAUSED
                                  ↓
                               GAME_OVER → READY_TO_PLAY | INITIAL
```

## Critical Concepts

**Deposit destination**: tokens go to `DepositPool PDA`'s `vaultAta` — NOT the treasury wallet's ATA. This is a common point of confusion. Seeds: `["deposit-pool", depositor, mint]`.

**Space token claim flow**: `prepareClaims` signs `{player, pool, amount, claimId, expiry}` with Convex authority keypair → client builds tx with Ed25519 pre-instruction + `claim` instruction → vault PDA transfers tokens → `ClaimRecord` PDA created for replay protection.

**ASTRDS mint flow**: `prepareMint` action verifies `tokenCount ≤ session.astrdsEarned`, signs `{player, amount, sessionId, expiry}` → client builds tx with Ed25519 pre-instruction + `mint_astrds` instruction → VaultConfig PDA CPIs `mintTo` → `MintRecord` PDA (`["mint-record", session_id]`) prevents replay. One mint per game session.

**ASTRDS mint authority**: held by VaultConfig PDA (`6zsWYibNCYYQJikHv8BHXRNynEACgFKsZPNXqWqBPbvv`), not the Convex keypair. Minting requires a wallet-signed on-chain transaction.

**Spawn tickets**: `requestSpawnTicket` validates active session + cooldown before any pool decrement. Client only spawns after a valid ticket is returned. `collectFromDeposit` atomically decrements pool and writes a persistent `collections` record.

**ASTRDS emission**: server reads Meteora pool price at session start → locks emission tier for that session (tier 1–5 by price; 5–100 pills; always 50 ASTRDS total allocation; uncollected pills burned). Tier breakpoints, pills-per-tier, and ASTRDS-per-pill are all admin-configurable via Convex `gameConfig`. Client cannot influence emission rate.

**Admin panel**: visible only to dev wallets defined in `app/src/config/devWallets.ts` (checked client-side in OverlayManager) and `app/convex/admin.ts` (enforced server-side in setGameConfig mutation). No API key required. Press backtick (`` ` ``) to open.

**Buyback + LP flow (two-phase)**: `game_payment` routes `buyback_bps` SOL to `BuybackVault` PDA. A separate permissionless `crank_liquidity` instruction swaps half accumulated SOL → ASTRDS via Meteora DAMM v2, adds two-sided LP, permanently locks the position. Callable from the Tokenomics overlay or via `scripts/simulateCrank.ts`. Position NFT mint PDA: `FAsVQSWkV8P3j1WsdsWdG7zE45i1tgX346Dm83NPCFj8`.

**Helius webhook**: watches Space Vault Program ID (`4bRZK8XfziVhLCgvtRdFJyTgN6tXGSPJT8xfbtt1AxBB`), not the treasury wallet. Three-path handler: skip authorized claims, activate pending deposits by tx signature, reconcile pool balances on unrecognized transfers.

**Convex is trusted for game state**: sessions, scores, chat, spawn tickets, collections, claims. Emission amounts are enforced server-side. Don't architect assuming Convex is trustless for on-chain token amounts.

**Theme system**: `themeStore` (Zustand, persisted) drives `theme-dark` / `theme-light` on the root element. CSS variable contract is shadcn-compatible. Canvas rendering reads live CSS variables via `designTokens.ts` — all entity colors are theme-aware. Theme-specific background assets for title, ready, and game-over screens.

## Docs

Read these before making significant changes in the relevant area:

- `docs/architecture.md` — system overview, layers, data flow
- `docs/status.md` — what's working, what's rough, known gaps, what's next
- `docs/spec.md` — product spec and functional requirements
- `docs/chain.md` — on-chain addresses, PDAs, all flow diagrams
- `docs/economy.md` — token economy design, emission model, flywheel, mainnet targets
- `docs/audio.md` — audio system framework, event triggers, bucket/playlist definitions
