---
status: draft
updated: 2026-04-24
---

# ASTRDS Economy Design

## North Star

> The economic structure of ASTRDS should be self-evident to players — they can see it happening.

Every mechanic should be:
- Observable — visible in-game, not hidden in a dashboard
- Verifiable — on-chain, not trusted to an admin
- Intuitive — players understand why their earnings just changed

The game IS the dashboard.

---

## What ASTRDS Is

A native game token earned by playing. No pre-mine. No team allocation. 100% earned through gameplay.

Deposited shitcoins are separate — chaotic, social, player-driven. Not part of the ASTRDS economic design.

---

## Supply

- Hard cap: 21,000,000 ASTRDS *(target — not yet enforced on-chain; see `docs/security.md`)*
- Allocation per game: 50 ASTRDS (reserved at game start)
- Total games to full emission: 420,000
- Total cash inflow at full emission: $105,000
- Emission unit: pills collected during a game
- Uncollected allocation: burned at game end *(currently tracked as "never minted" — no on-chain burn record yet; see `docs/security.md`)*
- Pills spawned but not collected are never minted — emission is skill-gated

---

## Liquidity Layer — Meteora DAMM v2

The market and liquidity layer is a **Meteora DAMM v2 pool: ASTRDS/SOL**.

- Pool is seeded at launch with minimum SOL to establish starting price
- Every quarter's `buyback_bps` slice (SOL) accumulates in the `BuybackVault` PDA
- A permissionless `crank_liquidity` instruction flushes accumulated SOL: wraps it, swaps half → ASTRDS, adds two-sided liquidity to the pool, permanently locks the position
- LP position owned by the vault is permanently locked — liquidity is never withdrawable
- All subsequent price movement is organic from gameplay
- SOL/USD price read from Jupiter API (60s cache) to derive USD-denominated emission tiers

**crank_liquidity = buyback + LP in one crank.** The instruction swaps half the accumulated SOL to ASTRDS (buying from the pool) and adds both sides as balanced liquidity. Net effect: every quarter deepens the pool and supports price — just asynchronously rather than inline.

**Why DAMM v2:**
- Token-2022 compatible (ASTRDS is Token-2022)
- Open source
- Supports locked/permanently locked liquidity natively
- Simpler than DLMM — no concentrated liquidity complexity needed at this stage

---

## Pricing Model

Price is determined by the AMM pool ratio — no oracle needed.

```
price_sol  = sol_reserve / astrds_reserve   (live from DAMM v2 pool)
price_usd  = price_sol × sol_usd_price      (Jupiter API, 60s cache)
```

Pool depth grows with every quarter (SOL deposited → LP locked). Burn pressure reduces circulating supply, reducing sell pressure on the pool. Both forces support price over time.

```
                ┌──────────────────────────────────────┐
                │  price_usd = (sol_reserve /           │
                │               astrds_reserve)         │
                │               × sol_usd_price         │
                └──────────────┬───────────────────────┘
                               │
            ┌──────────────────┴───────────────────┐
            │                                      │
    sol_reserve grows                      sell pressure falls
    (quarters → pool)                    (burns → less circulating)
            │                                      │
       ─────────                             ──────────
       quarters                             missed pills
```

---

## Emission Tiers (Procyclical)

The 50 ASTRDS allocation per game is fixed. Price determines how many pills carry it and at what denomination. Higher price = more pills spawned = more skill required to capture the full allocation.

| Price (derived) | Pills spawned | ASTRDS per pill | Full capture earns |
|---|---|---|---|
| Tier 1 (floor) | 5 | 10 | 50 |
| Tier 2 | 10 | 5 | 50 |
| Tier 3 | 25 | 2 | 50 |
| Tier 4 | 50 | 1 | 50 |
| Tier 5 (ceiling) | 100 | 0.5 | 50 |

Price breakpoints are **variable** — to be calibrated at mainnet launch against real seeded liquidity. Current table is structural, not final.

Tiers move up and down fluidly as price crosses bands. Not a one-way ratchet.

**Why procyclical:**
- Price up → more pills spawn → harder to capture all 50 → more burns → less sell pressure → price up further
- Price down → fewer pills → less sell pressure from new emissions → natural emission brake

**Emission is now server-authoritative.** The game server reads the pool at session start, locks in the emission tier for that session, and enforces the pill cap. The client cannot influence emission rate.

---

## The Quarter

- Cost per game: ~$0.25 in SOL
- Split weights are on-chain, publicly visible, admin-adjustable without program upgrade
- Target split (to be finalized at mainnet):
  - **Operational** — Railway, Helius, RPC, game server costs
  - **Operator** — fee to the entity running the game server
  - **Pool** — single-sided SOL deposit into the Meteora DAMM v2 pool (buyback + LP combined)

The pool slice accumulates in the `BuybackVault` PDA. A permissionless `crank_liquidity` instruction (separate tx) flushes accumulated SOL into Meteora — swap half → ASTRDS, add two-sided LP, permanently lock. Anyone can crank; the vault enforces the mechanics on-chain.

---

## The Flywheel

```
 ┌─────────────────────────────────────────────────────────────┐
 │                                                             │
 │   Player pays quarter (~$0.25 SOL)                         │
 │          │                                                  │
 │          ├──► Operational (infra costs)                     │
 │          │                                                  │
 │          ├──► Operator (server operator fee)                │
 │          │                                                  │
 │          └──► Pool slice ──► BuybackVault PDA               │
 │                    │         (accumulates SOL)              │
 │                    │         cranked → Meteora DAMM v2      │
 │                    │         (swap half → ASTRDS, add LP)   │
 │                    │                                        │
 │               sol_reserve grows                            │
 │               LP tokens → vault (locked forever)           │
 │                    │                                        │
 │              price_sol = sol_reserve / astrds_reserve       │
 │              price rises as pool deepens                    │
 │                    │                                        │
 │           higher tier unlocks                               │
 │                    │                                        │
 │         more pills spawn per game                           │
 │                    │                                        │
 │     player collects what they can                           │
 │             │                │                              │
 │         minted to        uncollected                        │
 │          player           → burned                          │
 │                               │                             │
 │                    circulating supply shrinks               │
 │                    sell pressure falls                      │
 │                    price rises further                      │
 │                               │                             │
 │         more incentive to play ─────────────────────────────┤
 │                                                             │
 └─────────────────────────────────────────────────────────────┘
```

Players can observe every step of this loop in real time.

---

## What Players See

The tokenomics overlay surfaces live economic state derived from on-chain data:

```
┌─────────────────────────────────────────────────────┐
│  ASTRDS ECONOMY                                     │
│                                                     │
│  Price          $0.0024        (from DAMM v2 pool)  │
│  Tier           2 of 5        (10 pills / 5 ASTRDS) │
│  Circulating    142,300        of 21,000,000        │
│  Pool depth     1.24 SOL      ($186 at $150/SOL)    │
│  Games played   2,846          of 420,000           │
│  Active pools   3              space token deposits  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

Not a static info screen — a live view of the economy breathing.

---

## Operational Sustainability

Total inflow at full emission (420,000 games × $0.25): **$105,000**

Revenue from operational split accumulates proportionally to games played — not time. The operation is self-funding from gameplay volume.

Costs (to be confirmed once infra is running at scale):
- Railway (game server)
- Helius API
- Convex
- RPC
- Netlify

Operational split % adjusted once real costs are known. Structure does not change.

---

## Variables (All Admin-Adjustable)

Everything soft. Structure hard.

**On-chain (trustless — target state):**
- Quarter price in SOL
- Revenue split weights and slice destinations
- Hard supply cap (21M) *(target — not yet enforced on-chain)*
- Allocation per game (50 ASTRDS)
- Emission tier bands (price breakpoints)
- Pills per tier, ASTRDS per pill per tier
- DAMM v2 pool address (stored in VaultConfig for CPI target)
- Per-wallet cooldown / rate limiting

**Convex (game state only):**
- Session lifecycle, scores, leaderboard
- Space deposit pools, spawn tickets, collections, claims
- Chat

**Game server (authoritative):**
- Emission tier enforcement (reads pool at session start, locks tier for session)
- Pill cap enforcement
- Score, pills, and token collection written to Convex

---

## Roadmap

```
NOW (devnet)
  ✓ Game server deployed — emission is server-authoritative
  ✓ Quarter payment splits on-chain (operational / operator / buyback)
  ✓ Buyback SOL accumulates in BuybackVault PDA per quarter
  ✓ crank_liquidity: swap half SOL → ASTRDS, add two-sided LP, permanently lock
  ✓ Emission tier read from live Meteora pool at session start
  ✓ Space token deposits, spawn tickets, collections, claims live
  ✓ Tokenomics overlay showing live pool state
  → crank_liquidity: verify end-to-end on devnet (game payment → buyback vault → LP add)
  → Finalize 3-way split percentages for mainnet

MAINNET
  → Seed DAMM v2 ASTRDS/SOL pool
  → LP tokens locked in vault PDA (permanently, verifiable on-chain)
  → Vault CPI into Meteora on every quarter payment
  → Emission tiers and split weights hardened on-chain
  → Price breakpoints calibrated against real seeded liquidity

FULL TRUSTLESS
  → All economic state on-chain
  → Convex handles only game state (sessions, scores, chat, leaderboard)
  → Players can verify everything without trusting anyone
```

---

## Parked / Decided

**Buyback mechanism → single-sided LP deposit**
A separate buyback step (swap SOL → ASTRDS via Jupiter) is unnecessary. A single-sided SOL deposit into the Meteora DAMM pool achieves the same price support effect — the pool internally swaps half the incoming SOL to ASTRDS to balance the deposit. Combined buyback+LP in one operation, one CPI, one transaction.

**LP token custody → vault PDA (locked forever)**
DAMM v2 supports permanently locked liquidity. LP tokens minted from pool deposits go to the vault PDA and are never redeemable. Liquidity is permanently locked — verifiable on-chain. Irreversibility is a feature.

**Quote asset → SOL**
SOL/USD price fetched from Jupiter API to derive USD-denominated emission tiers. Devnet pool validated this approach.

**Pool → Meteora DAMM v2**
Token-2022 compatible, open source, locked liquidity support. DLMM rejected — concentrated liquidity adds complexity not needed at this stage.

**Emission tier breakpoints → variable**
To be calibrated at mainnet launch against real seeded liquidity. Current tier table is structural only.

**Revenue split → 3-way (operational / operator / pool)**
Operator slice added to support community-run game servers. Pool slice replaces separate buyback+LP. On-chain weights, no program upgrade needed to adjust percentages.

---

## Open Questions

- Exact price tier breakpoints (set at mainnet launch against real liquidity)
- Final revenue split percentages for each of the three slices
- Death spiral protection — is the floor tier (5 pills, 10 ASTRDS/pill) sufficient in a prolonged bear market
- Whether the `meteora-damm-rust-sdk` crate should be pinned to a specific commit for build stability
- Operator whitelist design for community servers (trusted vs. open)
