# astrds — Agent Context

## What This Project Is

Solana Asteroids is a browser-based canvas game built with React/Vite. Players connect a Phantom wallet, sign a message to "insert quarter", play classic Asteroids gameplay, and earn ASTRDS tokens on Solana devnet. Scores persist to a Netlify Blobs leaderboard. Real-time chat runs via Pusher.

## Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS
- **State**: Zustand (9 stores + typed state machine)
- **Blockchain**: Solana web3.js, wallet-adapter, `@coral-xyz/anchor` (ASTRDS token program on devnet)
- **Backend**: Netlify Functions (esbuild), Netlify Blobs (score + session persistence)
- **Realtime**: Pusher (chat)
- **Package manager**: pnpm

## Running Locally

```bash
pnpm install
pnpm dev          # netlify dev — runs frontend + functions together (port 8888)
pnpm start        # vite only — no backend functions
```

Required env vars:
- `VITE_SOLANA_RPC_ENDPOINT` — Solana RPC URL
- `BLOB_READ_WRITE_TOKEN` — Netlify Blobs token
- `SITE_ID` — Netlify site ID (not auto-injected locally)
- `PROGRAM_AUTHORITY_PRIVATE_KEY` — Anchor program authority keypair (JSON array)
- Pusher vars for chat

## Key Files

```
src/App.tsx                              — root: wallet providers, audio init, layout
src/stores/stateMachine.ts               — game state machine (5 states, validated transitions)
src/stores/gameData.ts                   — score, session lifecycle, token verification
src/game/                                — entity classes and systems (Ship, Asteroid, Bullet, etc.)
src/screens/                             — screen components (title, ready, game, gameover, leaderboard, account, tokenomics)
src/screens/game/components/GameStateManager.tsx — drives screen routing from state machine
netlify/functions/                       — 8 serverless functions (scores, sessions, tokens, chat)
netlify.toml                             — build config, function bundler, /api/* redirect
```

## State Machine

```
INITIAL → READY_TO_PLAY → PLAYING ↔ PAUSED
                                  ↓
                               GAME_OVER → READY_TO_PLAY | INITIAL
```

## Netlify Functions

| Function | Purpose |
|---|---|
| `getScores` / `postScore` | Top-10 leaderboard |
| `getGame` / `postGame` / `updateGame` | Game session tracking |
| `mintTokens` / `burnTokens` | ASTRDS token operations via Anchor |
| `getChatMessages` / `postChatMessage` | Chat persistence + Pusher broadcast |

Frontend reaches functions via `/api/*` → `/.netlify/functions/:splat`.

## Docs

See `docs/` for architecture and status documentation.
- `docs/architecture.md` — system overview, layers, data flow, key config
- `docs/status.md` — what's working, what's rough, known gaps, what's next
