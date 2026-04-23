---
status: draft
updated: 2026-04-23
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

- Hard cap: 21,000,000 ASTRDS
- Allocation per game: 50 ASTRDS (reserved at game start)
- Total games to full emission: 420,000
- Total cash inflow at full emission: $105,000
- Emission unit: pills collected during a game
- Uncollected allocation: burned at game end
- Pills spawned but not collected are never minted — emission is skill-gated

---

## Liquidity Layer — Meteora DAMM v2

The market and liquidity layer is a **Meteora DAMM v2 pool: ASTRDS/USDC**.

USDC (not SOL) as the quote asset keeps the pricing formula clean — pool value moves only from ASTRDS buying pressure and LP additions, not from SOL price volatility.

- Pool is seeded at launch with minimum USDC to establish starting price
- Every quarter's buyback slice buys ASTRDS from this pool via Jupiter
- Every quarter's LP slice adds liquidity to this pool
- LP tokens are burned on mint — liquidity is permanently locked, trustless, verifiable on-chain
- All subsequent price movement is organic from gameplay

**Why DAMM v2:**
- Token-2022 compatible (ASTRDS is Token-2022)
- Open source
- Supports locked/permanently locked liquidity natively
- Simpler than DLMM — no concentrated liquidity complexity needed at this stage

---

## Pricing Model

Price is derived entirely from on-chain state. No oracle needed.

```
price = DAMM v2 pool USDC value / (21,000,000 - total burned)
```

- Pool USDC value grows with every quarter (buyback + LP additions)
- Burned supply shrinks the denominator
- Both forces push price up independently
- Price discovers itself through gameplay

```
                    ┌─────────────────────────────────┐
                    │  price = pool_usdc / (21M - burned) │
                    └──────────────┬──────────────────┘
                                   │
              ┌────────────────────┴────────────────────┐
              │                                         │
    pool_usdc grows                           burned grows
    (buyback + LP)                        (uncollected pills)
              │                                         │
         ─────────                               ──────────
         quarters                               missed pills
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
- Price up → more pills spawn → harder to capture all 50 → more burns → denominator shrinks → price up further
- Price down → fewer pills → less sell pressure from new emissions → natural emission brake

---

## The Quarter

- Cost per game: ~$0.25 in SOL
- Split weights are on-chain, publicly visible, admin-adjustable without program upgrade
- Placeholder split (to be finalized):
  - **Operational** — Railway, Helius, RPC, game server costs
  - **Buyback** — Jupiter swap: SOL → ASTRDS from DAMM v2 pool
  - **LP** — adds USDC liquidity to DAMM v2 pool

Additional slices may be added (community treasury, depositor incentive, dev fund). Structure supports N slices.

---

## The Flywheel

```
 ┌─────────────────────────────────────────────────────────────┐
 │                                                             │
 │   Player pays quarter ($0.25 SOL)                          │
 │          │                                                  │
 │          ├──► Operational (infra costs)                     │
 │          │                                                  │
 │          ├──► Buyback ──► Jupiter swap ──► buys ASTRDS      │
 │          │                                    │             │
 │          └──► LP ──────► DAMM v2 pool ◄───────┘             │
 │                               │                             │
 │                    pool USDC value grows                    │
 │                               │                             │
 │              price = pool_usdc / (21M - burned) rises       │
 │                               │                             │
 │                    higher tier unlocks                      │
 │                               │                             │
 │              more pills spawn per game                      │
 │                               │                             │
 │          player collects what they can                      │
 │                    │              │                         │
 │              minted to         uncollected                  │
 │               player            → burned                    │
 │                                    │                        │
 │                         denominator shrinks                 │
 │                         price rises further                 │
 │                                    │                        │
 │              more incentive to play ────────────────────────┤
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
│  Burned         8,640          all time             │
│  Pool depth     $1,240         USDC                 │
│  Games played   2,846          of 420,000           │
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
- Hard supply cap (21M)
- Allocation per game (50 ASTRDS)
- Emission tier bands (price breakpoints)
- Pills per tier, ASTRDS per pill per tier
- DAMM v2 pool address
- Per-wallet cooldown / rate limiting

**Convex (pre-game-server):**
- Pill spawn logic per level
- Level scaling factor
- Price read (from DAMM v2 pool + burn state)

---

## Roadmap

```
NOW (devnet)
  └─ Design the curve, keep values soft
  └─ Build tokenomics overlay as live dashboard
  └─ Prototype DAMM v2 pool on Meteora devnet
  └─ Prototype buyback + LP add flow in Convex

GAME SERVER
  └─ Server attests gameplay — pills collected can't be spoofed
  └─ Emission becomes trustless

MAINNET
  └─ Seed DAMM v2 ASTRDS/USDC pool
  └─ Burn LP tokens on mint (locked forever)
  └─ Jupiter swap integration: buyback + LP add per quarter
  └─ Emission tiers and split weights live on-chain
  └─ Hardened price breakpoints set against real liquidity

FULL TRUSTLESS
  └─ All economic state on-chain
  └─ Convex handles only game state (sessions, scores, chat, leaderboard)
  └─ Players can verify everything without trusting anyone
```

---

## Parked / Decided

**LP token custody → burn**
DAMM v2 supports permanently locked liquidity. LP tokens burned on mint. Liquidity can never be removed — verifiable on-chain. Irreversibility is a feature.

**Quote asset → USDC (not SOL)**
Keeps pricing formula isolated from SOL volatility. Pool value moves only from ASTRDS game activity.

**Pool → Meteora DAMM v2**
Token-2022 compatible, open source, locked liquidity support. DLMM rejected — concentrated liquidity adds complexity not needed at this stage.

**Emission tier breakpoints → variable**
To be calibrated at mainnet launch against real seeded liquidity. Current tier table is structural only.

**Revenue split → variable**
Placeholder: operational/buyback/LP. Additional slices possible. On-chain weights, no program upgrade needed to adjust.

---

## Open Questions

- Exact price tier breakpoints (set at mainnet launch)
- Final revenue split percentages and slice count
- Death spiral protection — is the floor tier (5 pills, 10 ASTRDS/pill) enough in a prolonged bear market
- Game server architecture and Railway cost estimates
- Whether DAMM v2 locked-liquidity mode is functionally equivalent to burning LP tokens (verify before committing to the narrative)
