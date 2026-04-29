---
status: current
updated: 2026-04-29
---

# Status

## Working

- Core game loop — ship, asteroids, bullets, collisions, particles, scoring
- **Game server** (`server/`) — authoritative WebSocket server deployed to Railway; client is pure renderer. Pause/resume wired via message protocol. Entity classes refactored to separate `update(dt, screen)` (physics) from `render(ctx)` (canvas) so simulation runs in Node without browser APIs. Game loop gated behind quarter verification via Convex sessions.
- **Emission tiers** — server refreshes admin config, reads Meteora pool price at session start, then locks the emission tier (tier 1–5 by price, 5–100 pills at varying ASTRDS-per-pill denominations, always 50 ASTRDS total allocation). Client cannot influence emission rate.
- **On-chain buyback accumulator** — `game_payment` routes `buyback_bps` slice to `BuybackVault` PDA. `crank_liquidity` (permissionless, separate tx) swaps half the accumulated SOL → ASTRDS via Meteora, adds two-sided LP, permanently locks position.
- **Shared simulation** (`shared/game/simulation.ts`) — browser-free physics layer; same code runs on server and is renderable client-side. Gameplay constants are admin-configurable via Convex-backed `gameConfig`; level difficulty/pickup budgets are resolved from persisted progression bands in `shared/game/progression.ts`.
- Solana wallet connection (Solana wallet-adapter) and signature-based auth ("Insert Quarter")
- State machine with validated transitions across all five states
- Screen flow: title → ready → game → gameover → leaderboard/account/tokenomics
- Audio system with per-channel volume, keyboard shortcuts (M, 1-5)
- Loading progress bar — wired to AudioService event emitter, updates correctly
- Convex backend: scores, game sessions, chat
- Reactive chat via Convex
- Top-10 leaderboard via Convex
- Token-2022 ASTRDS mint on devnet with native metadata
- **ASTRDS claim flow** — fully on-chain: `prepareMint` Convex action signs ed25519 authorization → client submits `mint_astrds` instruction → VaultConfig PDA CPIs `mintTo` → `MintRecord` PDA prevents replay (one mint per game session)
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
  - Game server periodically refreshes eligible pools from Convex by current level and injects Space Token entities only after a valid spawn ticket is issued
  - Collision: server-authoritative `collectFromDeposit` mutation validates ticket, atomically decrements pool — race-safe, multi-player safe
  - Persistent `collections` table records every pill collected — survives browser close
  - HUD (bottom-right) shows per-type space token counts with color dots; ASTRDS count separate
  - Game over screen + AccountScreen: `SpaceTokenClaim` shows pending collections, player claims via on-chain vault instruction
  - Claim: `prepareClaims` action signs ed25519 authorization → client builds + submits `claim` instruction → vault PDA transfers to player ATA
  - On-chain replay protection via `ClaimRecord` PDA (per claim ID)
  - `claims` table records every successful on-chain claim with tx signature
  - AccountScreen shows persistent space token claim history (last 10, across all games)
  - `reconcileAllPools` cron runs hourly — reconciles Convex pool balances against on-chain PDA reality
  - **Vault health check** (`VaultHealthCheck.tsx` in DEV overlay): enumerates all on-chain DepositPool PDAs, cross-references Convex, can sync missing/mismatched records back
- **Token management** (`TokenManager.tsx` in AccountScreen Tokens tab): unified panel — launch any SPL token into Space (replaces `SendToSpaceOverlay` flow for wallet tokens) + burn balances + close ATAs to reclaim rent; batch-close empty accounts via `signAllTransactions`
- **Admin config + progression planner** (`AdminScreen` / `LevelBandEditor`): dev-wallet-gated admin UI persists live game tuning to Convex via `/admin/config` (`ADMIN_API_KEY`). Config includes economy tiers plus ship, bullet, asteroid, pickup, and space-token opportunity tuning. Level Bands are no longer mock-only: persisted policy bands support asteroid count/speed curves, ship/powerup budgets, and per-level max lives. The preview has Table and Chart views with read-only Space Token availability overlays from depositor-authored level ranges.
- Dev tooling (`DevTools.tsx` in DEV overlay tab): Mint Test Token (deterministic keypair per tokenDir), Mint All, Fast Spawn toggle, Kill Ship, Vault Health Check
- `devTools.mintTestToken` action: creates Token-2022 with on-chain metadata; same mint address on repeat calls (deterministic SHA256 keypair derivation)
- **UI overhaul** — all overlay panels redesigned to Orb Explorer flat-row aesthetic: monospace data rows, `border-b` separators, no rounded cards; theme-aware surface/text/border tokens throughout
- **Full light/dark theme system** — persistent Zustand theme store, root `theme-dark` / `theme-light` classes, Header toggle, shadcn-compatible CSS variable contract, theme-specific title/ready/game-over background assets, and theme-aware canvas rendering via cached CSS variable tokens (`designTokens.ts`). Server snapshot protocol colors are resolved client-side so bullets, pickups, powerups, and space-token colors remain visible in both themes.
- **Custom wallet modal** (`GameWalletModal.tsx`) — replaces `@solana/wallet-adapter-react-ui` default modal; styled to match game aesthetic and theme tokens
- **Help overlay** — `Overlay.SHORTCUTS` renamed to `Overlay.HELP`; `HelpScreen` wraps keyboard shortcuts under a Keyboard sub-tab; Help added to both the overlay tab bar and Header nav
- **Nav alignment** — Header and overlay tab bar now show the same six items in the same order: $ASTRDS · Chat · Leaderboard · Account · Mining · Help
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
- Some older client-side game entity code remains outside the server-authoritative path and may need cleanup before reuse
- Large bundle (~500KB+) — no code splitting yet
- `eval` warning from a dependency in the build (rollup/rolldown flagged it)
- Player who collects a space token but closes browser before claiming → pool slot consumed, vault tokens never paid out (accepted limitation)
- Simultaneous collection of last token in pool by two players → first mutation wins, loser's token vanishes silently (extremely rare, accepted limitation)

## Next

- Audio system: SFX buckets, stinger playlists with ducking, level band playlists (issue #2)
- Continue monitoring `crank_liquidity` on devnet/mainnet-like conditions — game payment → BuybackVault accumulation → LP add → position locked
- Finalize revenue split percentages (operational / operator / buyback bps) for mainnet
- Mainnet migration when economy design is settled
- Mobile controls (Big fat maybe... [phonefags seething])
- Webhook handler: check `accountData.tokenBalanceChanges` for `INITIALIZE_ACCOUNT` type deposits so all devnet inbound transfers auto-activate via webhook (not just via action fallback)
