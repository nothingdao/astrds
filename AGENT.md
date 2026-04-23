# astrds — Agent Context

## What This Project Is

ASTRDS is a browser-based canvas game built with React/Vite. Players connect a Solana wallet, sign a transaction to "insert quarter", play classic Asteroids gameplay, and earn $ASTRDS tokens on Solana devnet. Third parties can deposit any SPL token into the on-chain vault — those tokens spawn as collectibles in-game and are claimed by players via on-chain vault instructions. Scores and chat persist via Convex. ASTRDS minting is server-side; space token claims use an ed25519-signed on-chain claim flow.

## Repo Structure

This is an Anchor monorepo:

```
/                              — Anchor workspace root
  Anchor.toml
  Cargo.toml
  programs/
    space-vault-program/       — on-chain vault program (Rust/Anchor)
      src/lib.rs
  tests/                       — Anchor test suite (TypeScript/Mocha)
  migrations/
  app/                         — frontend + Convex backend
    src/                       — React app
    convex/                    — Convex functions
    public/                    — static assets, sounds
    package.json
    vite.config.ts
    convex.json
    .env.local
```

## Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS
- **State**: Zustand (9 stores + typed state machine)
- **Blockchain**: Solana web3.js, wallet-adapter, SPL Token (Token-2022 + legacy)
- **On-chain program**: Anchor 0.32.1 — `programs/space-vault-program`
- **Backend**: Convex (reactive DB, serverless actions, real-time queries, HTTP router)
- **Webhooks**: Helius Enhanced Transactions watching treasury wallet
- **Package manager**: pnpm (frontend in `app/`), npm (Anchor workspace root)

## Running Locally

```bash
# Frontend + Convex
cd app
pnpm install
pnpm dev          # Vite + Convex concurrently
pnpm start        # Vite only (no Convex)

# Anchor program
cd /repo/root
anchor build
anchor test
```

Required env vars in `app/.env.local`:
- `VITE_CONVEX_URL` — Convex deployment URL
- `VITE_HELIUS_API_KEY` — Helius API key (network is hardcoded in `app/src/lib/solana.ts`)

Required Convex env vars (set via dashboard or `npx convex env set`):
- `PROGRAM_AUTHORITY_PRIVATE_KEY` — JSON array for authority keypair (ASTRDS minting + ed25519 claim signing)
- `SOLANA_RPC_ENDPOINT` — RPC used by Convex actions
- `HELIUS_WEBHOOK_SECRET` — shared secret validated on every webhook POST

## Key Files

```
app/src/App.tsx                                        — root: wallet providers, audio init, layout
app/src/stores/stateMachine.ts                         — game state machine (5 states, validated transitions)
app/src/stores/gameData.ts                             — score, session lifecycle
app/src/stores/spaceTokenStore.ts                      — collected space tokens, claim state
app/src/game/                                          — entity classes (Ship, Asteroid, Bullet, Pill, Token, etc.)
app/src/screens/                                       — screen components (title, ready, game, gameover, leaderboard, account, tokenomics)
app/src/screens/game/components/GameStateManager.tsx   — drives screen routing from state machine
app/src/components/space/SendToSpaceOverlay.tsx        — deposit flow UI (pick → configure → send → confirm)
app/src/screens/gameover/SpaceTokenClaim.tsx           — claim UI (also used in AccountScreen)
app/src/components/account/TokenBurnPanel.tsx          — burn + close token accounts to reclaim rent
app/src/lib/spaceVault.ts                              — on-chain tx builders: deposit, claim, game payment
app/src/lib/tokenColors.ts                             — deterministic color per mint address
app/src/utils/walletTokens.ts                          — fetch all SPL token accounts for a wallet + DAS metadata
app/convex/schema.ts                                   — DB tables: verifiedSessions, scores, gameSessions, chatMessages, players, spaceDeposits, spawnTickets, collections, claims
app/convex/spaceDeposits.ts                            — queries + mutations for pools, spawn tickets, collections, claims
app/convex/spaceDepositsActions.ts                     — "use node" actions: verify deposit, prepareClaims (ed25519), reconcile pools
app/convex/devTools.ts                                 — "use node" action: mint real devnet tokens (deterministic keypair per tokenDir)
app/convex/vaultHealth.ts                              — "use node" actions: enumerate on-chain DepositPool PDAs, sync to Convex
app/convex/http.ts                                     — HTTP router: /treasury-webhook
app/convex/webhookHandlers.ts                          — Helius webhook handler (inbound deposits + outbound drain detection)
app/convex/crons.ts                                    — hourly reconcileAllPools cron
programs/space-vault-program/src/lib.rs                — on-chain vault: deposits, claims (ed25519), game payments, revenue split
```

## State Machine

```
INITIAL → READY_TO_PLAY → PLAYING ↔ PAUSED
                                  ↓
                               GAME_OVER → READY_TO_PLAY | INITIAL
```

## Convex Backend

| File | Purpose |
|---|---|
| `app/convex/sessions.ts` | Verified wallet sessions |
| `app/convex/verifyPayment.ts` | Verifies Solana tx on-chain ("insert quarter") |
| `app/convex/scores.ts` | Top-10 leaderboard |
| `app/convex/gameSessions.ts` | Game session tracking |
| `app/convex/chat.ts` | Reactive chat (last 100 messages) |
| `app/convex/tokens.ts` | SPL mintTo via authority keypair (ASTRDS) |
| `app/convex/spaceDeposits.ts` | Queries + mutations for space token pools, spawn tickets, collections, claims |
| `app/convex/spaceDepositsActions.ts` | Verify deposit on-chain, prepareClaims (ed25519 signing), reconcile pools |
| `app/convex/devTools.ts` | Mint real devnet Token-2022 tokens (deterministic mint keypair per tokenDir) |
| `app/convex/vaultHealth.ts` | Enumerate on-chain DepositPool PDAs, cross-ref Convex, sync missing records |
| `app/convex/http.ts` | HTTP router — `/treasury-webhook` endpoint |
| `app/convex/webhookHandlers.ts` | Helius Enhanced Transaction webhook handler |
| `app/convex/crons.ts` | Hourly `reconcileAllPools` — caps Convex balances to on-chain reality |

## On-Chain Vault Program

`programs/space-vault-program` — Anchor 0.32.1, targets devnet.

PDAs: `VaultConfig` (singleton), `DepositPool` (per depositor+mint — owns vault ATA), `ClaimRecord` (per claim, replay protection).

Instructions: `initialize`, `set_weights`, `register_pool`, `deposit`, `claim` (requires ed25519 pre-instruction signed by Convex authority), `game_payment` (SOL split per weights).

## Token — ASTRDS

- Mint: `5sqKSHDKZr4KbNzj972PSfmEhtR9eLeBvv1nBRbeQAnB` (devnet, Token-2022)
- Authority: `CNhWD1cXNaCMcjJmFcK25aFgV3ZTAFtyFDBvGfKZcpzF` (Convex authority wallet)
- 1 token collected in-game = 1 $ASTRDS minted (max 200/game)

## Tokens in Space — Key Concepts

- **Deposit flow**: `registerDepositIntent` (pending record) → `buildSendToSpaceTransaction` (registerPool + deposit on-chain) → `confirmDepositFromChain` + `verifyAndConfirmDeposit` action (reads `tx.meta` for verified amount)
- **Deposit destination**: tokens go to DepositPool PDA's `vaultAta`, NOT the treasury wallet's ATA
- **Spawn tickets**: `requestSpawnTicket` mutation validates active session + per-player cooldown before pool decrement; client only spawns after a valid ticket is returned
- **Pool decrement**: `collectFromDeposit` validates ticket + atomically decrements pool — race-safe; writes persistent `collections` record
- **Claim flow**: `prepareClaims` action signs `{player, pool, amount, claimId, expiry}` with Convex keypair → client builds tx with Ed25519 pre-instruction + on-chain `claim` instruction → vault transfers from vaultAta to player ATA → `finalizeClaim` records in `claims` table
- **Claim replay protection**: `ClaimRecord` PDA created on-chain per claim ID — prevents double-spend
- **Claims persistence**: pending `collections` records visible on AccountScreen; player can claim tokens they missed on game-over screen
- **Drain detection**: outbound webhook transfers checked against `claims` table; unknown outbound triggers `reconcilePool`

## Docs

- `docs/architecture.md` — system overview, layers, data flow, key config
- `docs/status.md` — what's working, what's rough, known gaps, what's next
- `docs/spec.md` — product spec and functional requirements
- `docs/chain.md` — on-chain addresses, PDAs, flow diagrams
- `docs/economy.md` — token economy design, emission model, flywheel
- `docs/audio.md` — audio system framework, event triggers, bucket/playlist definitions
