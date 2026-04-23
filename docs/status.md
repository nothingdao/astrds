---
status: current
updated: 2026-04-23
---

# Status

## Working

- Core game loop — ship, asteroids, bullets, collisions, particles, scoring
- **Game server** (`server/`) — authoritative WebSocket server running locally at 30 tick/s; client is pure renderer when `VITE_WS_URL` is set. Pause/resume wired via message protocol. Entity classes refactored to separate `update(dt, screen)` (physics) from `render(ctx)` (canvas) so simulation runs in Node without browser APIs.
- **Shared simulation** (`shared/game/simulation.ts`) — browser-free physics layer; same code runs on server and is renderable client-side
- Solana wallet connection (Solana wallet-adapter) and signature-based auth ("Insert Quarter")
- State machine with validated transitions across all five states
- Screen flow: title → ready → game → gameover → leaderboard/account/tokenomics
- Audio system with per-channel volume, keyboard shortcuts (M, 1-5)
- Loading progress bar — wired to AudioService event emitter, updates correctly
- Convex backend: scores, game sessions, chat, ASTRDS token minting
- Reactive chat via Convex
- Top-10 leaderboard via Convex
- Token-2022 ASTRDS mint on devnet with native metadata
- ASTRDS claim flow on game over screen
- **Tokens in Space** — full end-to-end flow:
  - Anyone deposits any SPL token via `SendToSpaceOverlay` (on-chain vault tx → Convex record)
  - Deposit goes to on-chain DepositPool PDA's vault ATA — not treasury wallet directly
  - Deposit amount verified via `verifyAndConfirmDeposit` action reading `tx.meta` — client input never trusted for amounts
  - `spaceDeposits` Convex table tracks pools with `remainingAmount`, `status`, level range, spawn mode
  - Status lifecycle: `pending_verification` → `active` → `depleted` / `cancelled`
  - Helius webhook (`/treasury-webhook`) auto-activates deposits and detects external drains
  - `verifyAndConfirmDeposit` action as parallel verification (always runs alongside `confirmDepositFromChain`)
  - Spawn tickets: `requestSpawnTicket` mutation validates active session + cooldown before any pool decrement
  - Deposits spawn as colored Token entities during gameplay at level-appropriate times
  - Deterministic color per mint address (`src/lib/tokenColors.ts`) — stable across sessions
  - `SpacePoolSync` component reactively syncs active pools from Convex into `spaceTokenStore`
  - Collision: `collectFromDeposit` mutation validates ticket, atomically decrements pool — race-safe, multi-player safe
  - Persistent `collections` table records every pill collected — survives browser close
  - HUD (bottom-right) shows per-type space token counts with color dots; ASTRDS count separate
  - Game over screen + AccountScreen: `SpaceTokenClaim` shows pending collections, player claims via on-chain vault instruction
  - Claim: `prepareClaims` action signs ed25519 authorization → client builds + submits `claim` instruction → vault PDA transfers to player ATA
  - On-chain replay protection via `ClaimRecord` PDA (per claim ID)
  - `claims` table records every successful on-chain claim with tx signature
  - AccountScreen shows persistent space token claim history (last 10, across all games)
  - `reconcileAllPools` cron runs hourly — reconciles Convex pool balances against on-chain PDA reality
  - **Vault health check** (`VaultHealthCheck.tsx` in DEV overlay): enumerates all on-chain DepositPool PDAs, cross-references Convex, can sync missing/mismatched records back
- **Wallet cleanup** (`TokenBurnPanel.tsx` in AccountScreen): burn token balances + close ATAs to reclaim rent; supports TOKEN and TOKEN_2022; one-tx-per-account to isolate failures
- Dev tooling (`DevTools.tsx` in DEV overlay tab): Mint Test Token (deterministic keypair per tokenDir), Mint All, Fast Spawn toggle, Kill Ship, Vault Health Check
- `devTools.mintTestToken` action: creates Token-2022 with on-chain metadata; same mint address on repeat calls (deterministic SHA256 keypair derivation)
- Deployed to astrds.ndao.computer via Netlify (static host only)

## Partial / Rough

- Auth flow — `verifyPayment` Convex action wired and working on devnet; not battle-tested in prod
- Game session tracking — `gameSessions` create/update exists but session state not surfaced in HUD
- AccountScreen SOL/ASTRDS balances — fetched from chain via `getTokenBalances` util; works but minimal (no error handling, no loading retry)
- `decimals` field on `spaceDeposits` is `v.optional(v.number())` — fallback `?? 6` used in claim screen; old deposits without the field still work
- Helius devnet `INITIALIZE_ACCOUNT` type deposits — enhanced tx has empty `tokenTransfers`; webhook path doesn't activate these, `verifyAndConfirmDeposit` action fallback handles them correctly
- `stale depositId` in collections: if Convex deposits are cleared and re-synced from chain, existing `collections` records may reference stale IDs. `prepareClaims` handles this by falling back to mintAddress lookup.

## Known Gaps

- No error boundary or user-facing error UI for failed score submission or mint
- Pre-existing TypeScript strict mode errors in game entities and UI components (implicit any)
- Large bundle (~500KB+) — no code splitting yet
- `eval` warning from a dependency in the build (rollup/rolldown flagged it)
- Player who collects a space token but closes browser before claiming → pool slot consumed, vault tokens never paid out (accepted limitation)
- Simultaneous collection of last token in pool by two players → first mutation wins, loser's token vanishes silently (extremely rare, accepted limitation)

## Next

- Game server Railway deployment + CI/CD pipeline (issue #8)
- Wire Convex emission tiers + economic state into game server (issue #9) — prerequisite for trustless on-chain ASTRDS emission
- Mainnet migration when economy design is settled
- Mobile controls (Big fat maybe... [phonefags seething])
- Webhook handler: check `accountData.tokenBalanceChanges` for `INITIALIZE_ACCOUNT` type deposits so all devnet inbound transfers auto-activate via webhook (not just via action fallback)
