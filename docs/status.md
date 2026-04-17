---
status: current
updated: 2026-04-16
---

# Status

## Working

- Core game loop — ship, asteroids, bullets, collisions, particles, scoring
- Solana wallet connection (Solana wallet-adapter) and signature-based auth ("Insert Quarter")
- State machine with validated transitions across all five states
- Screen flow: title → ready → game → gameover → leaderboard/account/tokenomics
- Audio system with per-channel volume, keyboard shortcuts (M, 1-5)
- Loading progress bar — wired to AudioService event emitter, updates correctly
- Convex backend: scores, game sessions, chat, ASTRDS token minting
- Reactive chat via Convex (no Pusher)
- Top-10 leaderboard via Convex
- Token-2022 ASTRDS mint on devnet with native metadata
- ASTRDS claim flow on game over screen
- **Tokens in Space** — full end-to-end flow:
  - Anyone deposits any SPL token via `SendToSpaceOverlay` (on-chain tx → Convex record)
  - Deposit amount verified on-chain via `tx.meta` — client input never trusted
  - `spaceDeposits` Convex table tracks pools with `remainingAmount`, `status`, level range
  - Status lifecycle: `pending_verification` → `active` → `depleted` / `cancelled`
  - Helius webhook (`/treasury-webhook`) auto-activates deposits and detects external drains
  - `verifyAndConfirmDeposit` action as fallback when webhook hasn't fired (fires in parallel; 45s timeout shows manual verify button)
  - Deposits spawn as colored Token entities during gameplay at level-appropriate times
  - Deterministic color per mint address (`src/lib/tokenColors.ts`) — stable across sessions
  - `SpacePoolSync` component reactively syncs active pools from Convex into `spaceTokenStore`
  - Collision: `collectFromDeposit` mutation atomically decrements pool — race-safe, multi-player safe
  - HUD (bottom-right) shows per-type space token counts with color dots; ASTRDS count separate
  - Game over screen: `SpaceTokenClaim` shows mined tokens, player claims via `claimSpaceTokens` action
  - Claim: authority wallet transfers SPL tokens to player ATA on-chain; TOKEN vs TOKEN_2022 probed automatically
  - `claims` table records every successful on-chain claim with tx signature
  - AccountScreen shows persistent space token claim history (last 10, across all games)
  - `reconcileAllPools` cron runs hourly — reconciles Convex pool balances against on-chain ATA reality
  - Dev-seeded deposits bypass on-chain entirely — fake mints, Convex-only accounting
- Dev tooling (`DevTools.tsx`): Mint One / Mint All test tokens, Seed All Pools, Clear Dev, Clear All, Kill Ship, Fast Spawn toggle
- Deployed to astrds.ndao.computer via Netlify (static host only)

## Partial / Rough

- Auth flow — `verifyPayment` Convex action wired and working on devnet; not battle-tested in prod
- Game session tracking — `gameSessions` create/update exists but session state not surfaced in HUD
- AccountScreen SOL/ASTRDS balances — fetched from chain via `getTokenBalances` util; works but minimal (no error handling, no loading retry)
- `decimals` field on `spaceDeposits` is `v.optional(v.number())` — fallback `?? 6` used in claim screen; old deposits without the field still work
- Helius devnet `INITIALIZE_ACCOUNT` type deposits — enhanced tx has empty `tokenTransfers`; webhook path doesn't activate these, `verifyAndConfirmDeposit` action fallback handles them correctly

## Known Gaps

- No error boundary or user-facing error UI for failed score submission or mint
- Pre-existing TypeScript strict mode errors in game entities and UI components (implicit any)
- Large bundle (~500KB+) — no code splitting yet
- `eval` warning from a dependency in the build (rollup/rolldown flagged it)
- Player who collects a space token but closes browser before claiming → pool slot consumed, treasury tokens never paid out (accepted limitation)
- Simultaneous collection of last token in pool by two players → first mutation wins, loser's token vanishes silently (extremely rare, accepted limitation)

## Next

- Mainnet migration when economy design is settled
- Mobile controls
- Webhook handler: check `accountData.tokenBalanceChanges` for `INITIALIZE_ACCOUNT` type deposits so all devnet inbound transfers auto-activate via webhook (not just via action fallback)
