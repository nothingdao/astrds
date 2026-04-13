# astrds — Agent Context

## What This Project Is

ASTRDS is a browser-based canvas game built with React/Vite. Players connect a Phantom wallet, sign a transaction to "insert quarter", play classic Asteroids gameplay, and earn $ASTRDS tokens on Solana devnet. Scores and chat persist via Convex. Token minting is handled server-side via a Convex action calling SPL `mintTo`.

## Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS
- **State**: Zustand (9 stores + typed state machine)
- **Blockchain**: Solana web3.js, wallet-adapter, SPL Token (Token-2022, no Anchor)
- **Backend**: Convex (reactive DB, serverless actions, real-time queries)
- **Package manager**: pnpm

## Running Locally

```bash
pnpm install
pnpm dev          # Vite + Convex concurrently
pnpm start        # Vite only (no Convex)
```

Required env vars in `.env.local`:
- `VITE_CONVEX_URL` — Convex deployment URL
- `VITE_HELIUS_API_KEY` — Helius API key (network is hardcoded in `src/lib/solana.ts`)
- `PROGRAM_AUTHORITY_PRIVATE_KEY` is set in Convex dashboard, not locally

## Key Files

```
src/App.tsx                              — root: wallet providers, audio init, layout
src/stores/stateMachine.ts               — game state machine (5 states, validated transitions)
src/stores/gameData.ts                   — score, session lifecycle
src/game/                                — entity classes and systems (Ship, Asteroid, Bullet, etc.)
src/screens/                             — screen components (title, ready, game, gameover, leaderboard, account, tokenomics)
src/screens/game/components/GameStateManager.tsx — drives screen routing from state machine
convex/                                  — backend: schema, sessions, scores, chat, tokens
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
| `convex/sessions.ts` | Verified wallet sessions |
| `convex/verifyPayment.ts` | Verifies Solana tx on-chain ("insert quarter") |
| `convex/scores.ts` | Top-10 leaderboard |
| `convex/gameSessions.ts` | Game session tracking |
| `convex/chat.ts` | Reactive chat (last 100 messages) |
| `convex/tokens.ts` | SPL mintTo via authority keypair |

## Token

- Mint: `5sqKSHDKZr4KbNzj972PSfmEhtR9eLeBvv1nBRbeQAnB` (devnet, Token-2022)
- Authority: `CNhWD1cXNaCMcjJmFcK25aFgV3ZTAFtyFDBvGfKZcpzF`
- 1 token collected in-game = 1 $ASTRDS minted (max 200/game)

## Docs

- `docs/architecture.md` — system overview, layers, data flow, key config
- `docs/status.md` — what's working, what's rough, known gaps, what's next
