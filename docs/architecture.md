---
status: current
updated: 2026-04-11
---

# Architecture

## Overview

ASTRDS is a browser-based canvas game built with React/Vite. Players connect a Phantom wallet, pay to play via wallet signature, collect $ASTRDS tokens during gameplay, and claim them on game over via on-chain SPL mint. Backend runs entirely on Convex — reactive DB, serverless actions, real-time queries.

## Layers

### Frontend (src/)

- **Game engine** — canvas-based, driven by `engineStore.ts`. Entity classes: `Ship`, `Asteroid`, `Bullet`, `Particle`, `Pill`, `Token`, `ShipPickup`. Systems: `ParticleSystem`, collision detection in engine store.
- **Screens** — `title`, `ready`, `game`, `gameover`, `leaderboard`, `account`, `tokenomics`. Managed by `GameStateManager.tsx` which reads the state machine.
- **State** — 9 Zustand stores. `stateMachine.ts` is the source of truth for screen flow. Other stores: `audioStore`, `authStore`, `chatStore`, `engineStore`, `gameData`, `inventoryStore`, `levelStore`, `overlayStore`, `powerupStore`.
- **Blockchain** — Solana wallet-adapter (Phantom). Auth via wallet signature verified server-side in Convex. Token minting via Convex action calling SPL `mintTo`.
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
| `tokens.ts` | "use node" action — SPL mintTo via authority keypair |

### Token

- Mint: `5sqKSHDKZr4KbNzj972PSfmEhtR9eLeBvv1nBRbeQAnB`
- Program: Token-2022 (`TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb`)
- Authority: `CNhWD1cXNaCMcjJmFcK25aFgV3ZTAFtyFDBvGfKZcpzF`
- Metadata: name=ASTRDS, symbol=ASTRDS, URI=https://astrds.ndao.computer/token.json
- 9 decimals, 1 token collected in-game = 1 $ASTRDS minted

## Data Flow (typical game)

1. Wallet connects → `authStore` updates → title screen unlocks
2. "Insert Quarter" → wallet signs tx → `verifyPayment` action verifies on-chain → session stored in Convex → `INITIAL → READY_TO_PLAY`
3. Game starts → `gameSessions.create` → `READY_TO_PLAY → PLAYING`
4. Gameplay → score increments in `gameData`; tokens collected increment `inventoryStore`
5. Death → `PLAYING → GAME_OVER` → `endGameSession` submits score; `ASTRDSMinting` component lets player claim tokens
6. Claim → `mintTokens` Convex action calls SPL `mintTo` → tokens land in player wallet

## Key Config

- `netlify.toml` — static build only, no functions
- `vite.config.ts` — Vite/React build
- `convex/schema.ts` — DB tables: verifiedSessions, scores, gameSessions, chatMessages
- `VITE_CONVEX_URL` — Convex deployment URL (frontend)
- `PROGRAM_AUTHORITY_PRIVATE_KEY` — SPL mint authority keypair (Convex env, not frontend)
- `VITE_HELIUS_API_KEY` — Helius API key (network hardcoded in `src/lib/solana.ts`)

## Out of Scope (currently)

- Mobile controls
- Mainnet deployment
- "Launch to space" token economy (designed, not built)
- Achievement system
