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
  app/
    src/                                    — React frontend
    convex/                                 — Convex backend functions
    public/                                 — static assets, token metadata, sounds
  server/
    src/index.ts                            — WebSocket game server (Node, ws)
    src/ws/SessionHandler.ts               — per-connection game loop + message handler
    src/game/GameSession.ts                — wraps simulation, exposes snapshot/update/resize
  shared/
    game/protocol.ts                        — ClientToServerMessage / ServerToClientMessage / GameSnapshot types
    game/simulation.ts                      — authoritative game logic (no browser APIs)
```

## Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS
- **State**: Zustand (9 stores + typed state machine)
- **Blockchain**: Solana web3.js, wallet-adapter, SPL Token (Token-2022 + legacy), Anchor 0.32.1
- **Backend**: Convex (reactive DB, serverless actions, real-time queries, HTTP router)
- **Game server**: Node.js WebSocket server (`server/`) — authoritative loop at 30 tick/s; client is renderer only
- **Webhooks**: Helius Enhanced Transactions
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
- `PROGRAM_AUTHORITY_PRIVATE_KEY` — authority keypair (ASTRDS minting + ed25519 claim signing)
- `SOLANA_RPC_ENDPOINT`
- `HELIUS_WEBHOOK_SECRET`

## Key Files

```
app/src/App.tsx                                       — root: wallet providers, audio init, layout
app/src/stores/stateMachine.ts                        — game state machine (5 states, validated transitions)
app/src/stores/gameData.ts                            — score, session lifecycle
app/src/stores/spaceTokenStore.ts                     — collected space tokens, claim state
app/src/game/                                         — entity classes (Ship, Asteroid, Bullet, Pill, Token, etc.)
app/src/screens/                                      — screen components (title, ready, game, gameover, leaderboard, account, tokenomics)
app/src/screens/game/GameScreen.tsx                   — always delegates to ServerGameScreen (game server required)
app/src/screens/game/ServerGameScreen.tsx             — WebSocket client; renders snapshots, sends input, hydrates stores
app/src/screens/game/components/GameStateManager.tsx  — drives screen routing from state machine
app/src/components/space/SendToSpaceOverlay.tsx       — deposit flow UI (pick → configure → send → confirm)
app/src/screens/gameover/SpaceTokenClaim.tsx          — claim UI (also used in AccountScreen)
app/src/components/account/TokenManager.tsx           — unified token management: launch into Space + burn/close accounts
app/src/components/wallet/GameWalletModal.tsx         — custom styled wallet connect dialog (replaces library modal)
app/src/screens/help/HelpScreen.tsx                   — Help overlay with Keyboard sub-tab
app/src/lib/spaceVault.ts                             — on-chain tx builders: deposit, claim, game payment
app/src/lib/tokenColors.ts                            — deterministic color per mint address
app/src/lib/tokenomics.ts                             — Meteora pool snapshot, SOL/USD price, emission tier lookup
app/src/utils/walletTokens.ts                         — fetch all SPL token accounts for a wallet + DAS metadata
app/convex/schema.ts                                  — DB tables: verifiedSessions, scores, gameSessions, chatMessages, players, spaceDeposits, spawnTickets, collections, claims
app/convex/spaceDeposits.ts                           — queries + mutations for pools, spawn tickets, collections, claims
app/convex/spaceDepositsActions.ts                    — "use node" actions: verify deposit, prepareClaims (ed25519), reconcile pools
app/convex/tokens.ts                                  — "use node" action: SPL mintTo for ASTRDS via authority keypair
app/convex/prices.ts                                  — SOL/USD price feed from Jupiter API (cached)
app/convex/economySnapshots.ts                        — periodic snapshots of live economic state
app/convex/admin.ts                                   — admin-gated mutations for operator tooling
app/convex/devTools.ts                                — mint real devnet tokens (deterministic keypair per tokenDir)
app/convex/vaultHealth.ts                             — enumerate on-chain DepositPool PDAs, sync to Convex
app/convex/http.ts                                    — HTTP router: /treasury-webhook
app/convex/webhookHandlers.ts                         — Helius webhook handler (inbound deposits + outbound drain detection)
app/convex/crons.ts                                   — hourly reconcileAllPools cron
programs/space-vault-program/src/lib.rs               — on-chain vault: deposits, claims (ed25519), game payments, revenue split
server/src/index.ts                                   — WebSocket server: HTTP health check + ws upgrade
server/src/ws/SessionHandler.ts                       — per-connection 30 tick/s loop, pause/resume, message routing
server/src/game/GameSession.ts                        — wraps simulation; exposes snapshot(), update(), resize(), reset()
shared/game/protocol.ts                               — shared message + snapshot types (ClientToServerMessage, ServerToClientMessage, GameSnapshot)
shared/game/simulation.ts                             — authoritative physics simulation (no browser/React/Convex deps)
```

## State Machine

```
INITIAL → READY_TO_PLAY → PLAYING ↔ PAUSED
                                  ↓
                               GAME_OVER → READY_TO_PLAY | INITIAL
```

## Critical Concepts

**Deposit destination**: tokens go to `DepositPool PDA`'s `vaultAta` — NOT the treasury wallet's ATA. This is a common point of confusion.

**Claim flow**: `prepareClaims` signs `{player, pool, amount, claimId, expiry}` with Convex authority keypair → client builds tx with Ed25519 pre-instruction + `claim` instruction → vault transfers tokens → `ClaimRecord` PDA created for replay protection.

**Spawn tickets**: `requestSpawnTicket` validates active session + cooldown before any pool decrement. Client only spawns after a valid ticket is returned. `collectFromDeposit` atomically decrements pool and writes a persistent `collections` record.

**ASTRDS emission**: server reads Meteora pool price at session start → locks emission tier for that session (tier 1–5 by price; 5–100 pills; always 50 ASTRDS total allocation; uncollected pills burned). Client cannot influence emission rate. See `docs/economy.md`.

**Buyback + LP flow (two-phase)**: `game_payment` routes `buyback_bps` SOL to `BuybackVault` PDA. A separate permissionless `crank_liquidity` instruction swaps half accumulated SOL → ASTRDS via Meteora, adds two-sided LP, permanently locks the position. The Meteora position NFT mint PDA is `FAsVQSWkV8P3j1WsdsWdG7zE45i1tgX346Dm83NPCFj8`.

**Convex is trusted for game state**: sessions, scores, chat, spawn tickets, collections, claims. Emission amounts are enforced server-side. Don't architect assuming Convex is trustless for on-chain token amounts.

## Docs

Read these before making significant changes in the relevant area:

- `docs/architecture.md` — system overview, layers, data flow
- `docs/status.md` — what's working, what's rough, known gaps, what's next
- `docs/spec.md` — product spec and functional requirements
- `docs/chain.md` — on-chain addresses, PDAs, all flow diagrams
- `docs/economy.md` — token economy design, emission model, flywheel, mainnet targets
- `docs/audio.md` — audio system framework, event triggers, bucket/playlist definitions
