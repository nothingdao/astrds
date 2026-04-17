# astrds — Agent Context

## What This Project Is

ASTRDS is a browser-based canvas game built with React/Vite. Players connect a Solana wallet, sign a transaction to "insert quarter", play classic Asteroids gameplay, and earn $ASTRDS tokens on Solana devnet. Third parties can deposit any SPL token into the game treasury — those tokens spawn as collectibles in-game and are claimed by players on game over. Scores and chat persist via Convex. Token minting and claim transfers are handled server-side via Convex actions calling SPL.

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
- `PROGRAM_AUTHORITY_PRIVATE_KEY` — JSON array for authority keypair (minting + claim transfers)
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
app/src/components/space/SendToSpaceOverlay.tsx        — deposit flow UI (pick → configure → send → verify → done)
app/src/components/space/SpaceTokenClaim.tsx           — game-over claim UI
app/src/lib/tokenTransfer.ts                           — builds unsigned SPL transfer tx for deposits
app/src/lib/tokenColors.ts                             — deterministic color per mint address
app/convex/schema.ts                                   — DB tables: verifiedSessions, scores, gameSessions, chatMessages, players, spaceDeposits, claims
app/convex/spaceDeposits.ts                            — queries + mutations for pools and claims
app/convex/spaceDepositsActions.ts                     — "use node" actions: verify deposit, claim transfer, reconcile pools
app/convex/http.ts                                     — HTTP router: /treasury-webhook
app/convex/webhookHandlers.ts                          — Helius webhook handler (inbound deposits + outbound drain detection)
app/convex/crons.ts                                    — hourly reconcileAllPools cron
programs/space-vault-program/src/lib.rs                — on-chain vault: deposits, claims, game payments, revenue split
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
| `app/convex/tokens.ts` | SPL mintTo via authority keypair |
| `app/convex/spaceDeposits.ts` | Queries + mutations for space token pools and claims |
| `app/convex/spaceDepositsActions.ts` | Verify deposit on-chain, execute claim transfer, reconcile pool |
| `app/convex/http.ts` | HTTP router — `/treasury-webhook` endpoint |
| `app/convex/webhookHandlers.ts` | Helius Enhanced Transaction webhook handler |
| `app/convex/crons.ts` | Hourly `reconcileAllPools` — caps Convex balances to on-chain reality |
| `app/convex/devMutations.ts` | Dev-only: seed fake pools, clear deposits |

## On-Chain Vault Program

`programs/space-vault-program` — Anchor 0.32.1, targets devnet.

PDAs: `VaultConfig` (singleton), `DepositPool` (per depositor+mint), `ClaimRecord` (per claim, replay protection).

Instructions: `initialize`, `set_weights`, `register_pool`, `deposit`, `claim` (ed25519 pre-instruction, Convex authority signature), `game_payment` (SOL split per weights).

See GitHub issue #3 for full spec.

## Token — ASTRDS

- Mint: `5sqKSHDKZr4KbNzj972PSfmEhtR9eLeBvv1nBRbeQAnB` (devnet, Token-2022)
- Authority: `CNhWD1cXNaCMcjJmFcK25aFgV3ZTAFtyFDBvGfKZcpzF` (treasury wallet — also holds deposited space tokens)
- 1 token collected in-game = 1 $ASTRDS minted (max 200/game)

## Tokens in Space — Key Concepts

- **Deposit flow**: `registerDepositIntent` (pending record) → tx sign → `submitDepositTransaction` → webhook OR `verifyAndConfirmDeposit` action activates with verified on-chain amount
- **Amount trust**: `totalAmount` in Convex is always from `tx.meta` — never from client input
- **Pool decrement**: `collectFromDeposit` mutation is atomic (Convex serialized) — race-safe across concurrent players
- **Claims persistence**: `claims` table records every on-chain claim; `getClaimsByWallet` query surfaces history on AccountScreen
- **Drain detection**: outbound webhook transfers checked against `claims` table; unknown outbound triggers `reconcilePool`
- **Dev deposits**: txSignature starts with `dev-seed-` → skip on-chain in claim + reconcile

## Docs

- `docs/architecture.md` — system overview, layers, data flow, key config
- `docs/status.md` — what's working, what's rough, known gaps, what's next
- `SPEC.md` — product spec and functional requirements
- `docs/AUDIO.md` — audio system framework, event triggers, bucket/playlist definitions
