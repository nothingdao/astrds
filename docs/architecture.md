---
status: complete
updated: 2026-04-11
---

# Architecture

## Overview

Solana Asteroids is a browser-based canvas game built with React/Vite. It integrates Solana wallet auth, an on-chain token (ASTRDS), real-time chat, and a serverless backend on Netlify.

## Layers

### Frontend (src/)

- **Game engine** — canvas-based, runs in `GameScreen.tsx`. Entity classes: `Ship`, `Asteroid`, `Bullet`, `Particle`, `Pill`, `Token`, `ShipPickup`. Systems: `BulletSystem`, `ParticleSystem`, `InventoryManager`.
- **Screens** — `title`, `ready`, `game`, `gameover`, `leaderboard`, `account`, `tokenomics`. Managed by `GameStateManager.tsx` which reads the state machine.
- **State** — 9 Zustand stores. `stateMachine.ts` is the source of truth for screen flow. Other stores: `audioStore`, `authStore`, `chatStore`, `engineStore`, `gameData`, `inventoryStore`, `levelStore`, `overlayStore`, `walletStore`, `powerupStore`, `settingsPanelStore`.
- **Blockchain** — Solana wallet-adapter (Phantom), `@coral-xyz/anchor` for the ASTRDS token program. Wallet connection handled in `usePhantom` hook; auth state in `authStore`.
- **Chat** — Pusher-backed real-time chat. `ChatSystem.tsx` wraps `ChatBase`, `FullChat`, `OverlayChat`. Frontend service in `src/services/chat.ts`.

### State Machine

Five states with validated transitions (enforced at runtime):

```
INITIAL → READY_TO_PLAY → PLAYING ↔ PAUSED
                                  ↓
                               GAME_OVER → READY_TO_PLAY | INITIAL
```

### Backend (netlify/functions/)

Eight serverless functions, all returning JSON with CORS headers. Persistence via Netlify Blobs (`@netlify/blobs`).

| Function | Purpose |
|---|---|
| `getScores` / `postScore` | Top-10 leaderboard in `high-scores` blob store |
| `getGame` / `postGame` / `updateGame` | Game session lifecycle in `game-sessions` blob store |
| `mintTokens` / `burnTokens` | ASTRDS token minting/burning via Anchor program on devnet |
| `getChatMessages` / `postChatMessage` | Chat persistence + Pusher broadcast |

Frontend calls functions via `/api/*` → `/.netlify/functions/:splat` (redirect in `netlify.toml`).

## Data Flow (typical game)

1. Wallet connects → `authStore` updates → title screen unlocks
2. "Insert Quarter" wallet signature → `INITIAL → READY_TO_PLAY`
3. Game start → `postGame` creates session → `READY_TO_PLAY → PLAYING`
4. Gameplay → score increments in `gameData` store; tokens earned logged to session via `updateGame`
5. Death → `PLAYING → GAME_OVER` → `postScore` submits to leaderboard; `mintTokens` called if tokens earned
6. Leaderboard/account screens pull from blob store and on-chain token balance

## Key Config

- `netlify.toml` — build, function bundler (esbuild), `/api/*` redirect, Node 18
- `vite.config.js` — Vite/React build
- `VITE_SOLANA_RPC_ENDPOINT` — Solana RPC (mainnet-beta adapter configured, devnet used for tokens)
- `BLOB_READ_WRITE_TOKEN`, `SITE_ID` — Netlify Blobs access
- `PROGRAM_AUTHORITY_PRIVATE_KEY` — Anchor program authority for minting

## Out of Scope (currently)

- Mobile controls
- Global leaderboard beyond top-10
- Mainnet token deployment
- Achievement system
