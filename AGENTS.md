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
- `ADMIN_API_KEY` — required for HTTP admin endpoints: `/admin/config` and `/game-server/set-astrds-earned`

## Key Files

```
app/src/App.tsx                          — root: wallet providers, theme init, audio init, layout
app/src/stores/stateMachine.ts           — game state machine (5 states, validated transitions)
app/src/stores/gameData.ts               — score, session lifecycle
app/src/stores/spaceTokenStore.ts        — collected space tokens, claim state
app/src/config/devWallets.ts             — DEV_WALLETS set + isDevWallet(); controls Admin tab
app/src/lib/spaceVault.ts               — on-chain tx builders: deposit, claim, game payment, mint_astrds
app/src/lib/designTokens.ts             — reads CSS vars at runtime for theme-aware canvas rendering
app/src/screens/game/ServerGameScreen.tsx          — WebSocket client; renders snapshots, sends input
app/src/screens/admin/AdminScreen.tsx              — admin panel (dev wallets only; ADMIN_API_KEY to save)
app/src/components/space/SendToSpaceOverlay.tsx    — deposit flow UI
app/src/components/tokens/ASTRDSMinting.tsx        — claim UI: prepareMint → wallet tx → mint_astrds
app/src/components/account/TokenManager.tsx        — launch tokens into Space, burn/close accounts
app/src/screens/gameover/SpaceTokenClaim.tsx       — space token claim UI (also in AccountScreen)
app/convex/schema.ts                     — DB tables (verifiedSessions, gameSessions, spaceDeposits, collections, claims, gameConfig, …)
app/convex/admin.ts                      — getGameConfig; setGameConfigInternal; updateConfigHttp (ADMIN_API_KEY)
app/convex/tokens.ts                     — prepareMint (ed25519 mint auth); mintTokens deprecated
app/convex/spaceDeposits.ts              — pools, spawn tickets, collections, claims mutations
app/convex/spaceDepositsActions.ts       — verifyDeposit, prepareClaims (ed25519), reconcilePools
app/convex/http.ts                       — /treasury-webhook, /admin/config, /game-server/set-astrds-earned
app/convex/webhookHandlers.ts            — Helius webhook: activate deposits, reconcile on drain
programs/space-vault-program/src/lib.rs  — on-chain vault: deposits, claims, game_payment, mint_astrds, crank_liquidity
server/src/ws/SessionHandler.ts          — per-connection 30 tick/s loop, pause/resume, message routing
server/src/game/emissionTiers.ts         — fetches Meteora pool price, derives emission tier
server/src/convex/client.ts             — ConvexServerClient: session verify, config, setAstrdsEarned
shared/game/protocol.ts                 — ClientToServerMessage / ServerToClientMessage / GameSnapshot types
shared/game/simulation.ts               — authoritative physics (no browser/React/Convex deps)
```

## State Machine

```
INITIAL → READY_TO_PLAY → PLAYING ↔ PAUSED
                                  ↓
                               GAME_OVER → READY_TO_PLAY | INITIAL
```

## Critical Gotchas

**Deposit destination**: tokens go to `DepositPool PDA`'s `vaultAta` — NOT the treasury wallet's ATA. Common confusion point. Seeds: `["deposit-pool", depositor, mint]`.

**ASTRDS mint authority**: held by VaultConfig PDA (`6zsWYibNCYYQJikHv8BHXRNynEACgFKsZPNXqWqBPbvv`), not the Convex keypair. `mintTokens` action is dead code — mint only works via on-chain `mint_astrds` + ed25519 auth from `prepareMint`.

**ASTRDS emission is server-authoritative**: tier locked at session start from live Meteora pool price (tier 1–5; 5–100 pills; always 50 ASTRDS max). Game server writes `astrdsEarned` via authenticated HTTP (`ADMIN_API_KEY`) — client cannot influence emission.

**Spawn tickets gate pool access**: `requestSpawnTicket` validates paid session + cooldown before any pool decrement. `collectFromDeposit` is atomic (serialized Convex mutation). Client never touches pool state directly.

**Convex is trusted for game state**: sessions, scores, spawn tickets, collections, claims are all Convex-authoritative. Don't treat Convex as untrusted for these.

**Admin panel**: dev-wallet-gated client-side (OverlayManager); saving config requires `ADMIN_API_KEY` POSTed to `/admin/config`. Press backtick to open. No public `setGameConfig` mutation exists.

**Helius webhook**: watches Space Vault Program ID, not treasury wallet. Three paths: skip authorized claims, activate pending deposits, reconcile on unknown outbound.

**Theme-aware canvas**: canvas cannot use Tailwind — `designTokens.ts` reads live CSS vars. `resolveCanvasColor` maps legacy protocol colors to current theme tokens.

For full flow diagrams (deposit → spawn → collect → claim, ASTRDS mint, buyback/LP), see `docs/chain.md`.

## Docs

Read these before making significant changes in the relevant area:

- `docs/architecture.md` — system overview, layers, data flow
- `docs/status.md` — what's working, what's rough, known gaps, what's next
- `docs/spec.md` — product spec and functional requirements
- `docs/chain.md` — on-chain addresses, PDAs, all flow diagrams
- `docs/economy.md` — token economy design, emission model, flywheel, mainnet targets
- `docs/audio.md` — audio system framework, event triggers, bucket/playlist definitions
- `docs/security.md` — security findings, fixed exploits, open issues, pre-mainnet blockers
