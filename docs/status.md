---
status: current
updated: 2026-04-11
---

# Status

## Working

- Core game loop — ship, asteroids, bullets, collisions, particles, scoring
- Solana wallet connection (Phantom) and signature-based auth ("Insert Quarter")
- State machine with validated transitions across all five states
- Screen flow: title → ready → game → gameover → leaderboard/account/tokenomics
- Audio system with per-channel volume, keyboard shortcuts (M, 1-5)
- Convex backend: scores, game sessions, chat, token minting
- Reactive chat via Convex (no Pusher)
- Top-10 leaderboard via Convex
- Token-2022 ASTRDS mint on devnet with native metadata
- Token claim flow on game over screen (ASTRDSMinting component)
- Deployed to astrds.ndao.computer via Netlify (static host only)

## Partial / Rough

- Auth flow — `verifyPayment` Convex action wired but untested end-to-end in production
- Game session tracking — `gameSessions` create/update exists but session state not surfaced in HUD
- Loading screen — progress bar wired to audio init only; stuck at 0%
- AccountScreen — uses Convex scores reactively but `getTokenBalances` util is a stub

## Known Gaps

- No error boundary or user-facing error UI for failed score submission or mint
- Pre-existing TypeScript strict mode errors in game entities and UI components (implicit any)
- Large bundle (~500KB+) — no code splitting yet
- `eval` warning from a dependency in the build (rollup/rolldown flagged it)

## Next (game focus)

- End-to-end test: wallet connect → insert quarter → play → game over → claim tokens
- Fix loading progress indicator
- Surface token count in game HUD
- "Launch to space" token economy — send any SPL token to space wallet, spawns as collectible
- Mainnet migration when economy design is settled
