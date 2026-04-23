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

## What ASTRDS Is

A native game token earned by playing. No pre-mine. No team allocation. 100% earned through gameplay.

Deposited shitcoins are separate — chaotic, social, player-driven. Not part of the ASTRDS economic design.

## Supply

- Hard cap: 21,000,000 ASTRDS
- Allocation per game: 50 ASTRDS (reserved at game start)
- Total games to full emission: 420,000
- Total cash inflow at full emission: $105,000
- Emission unit: pills collected during a game
- Uncollected allocation: burned at game end
- Pills spawned but not collected are never minted — emission is skill-gated

## Pricing Model

Price is derived entirely from on-chain state. No oracle needed.

```
price = LP pool value / (21,000,000 - total burned)
```

- Pool grows with every quarter (buyback + LP additions)
- Burned supply shrinks the denominator
- Both forces push price up
- Price discovers itself through gameplay — no external input required

Pool is seeded at launch with minimum SOL to establish the starting ratio. All subsequent price movement is organic.

## Emission Tiers (Procyclical)

The 50 ASTRDS allocation per game is fixed. Price determines how many pills carry it and at what denomination. Higher price = more pills spawned = more skill required to capture full allocation.

| Price (derived) | Pills spawned | ASTRDS per pill | Full capture earns |
|---|---|---|---|
| < $0.0024 | 5 | 10 | 50 |
| $0.0024 – $0.01 | 10 | 5 | 50 |
| $0.01 – $0.05 | 25 | 2 | 50 |
| $0.05 – $0.10 | 50 | 1 | 50 |
| > $0.10 | 100 | 0.5 | 50 |

Price tiers are fluid — they move up and down as price crosses bands. Not a one-way ratchet.

**Why procyclical:**
- Price up → more pills → more engaging → more quarters → more buyback → price up
- Price down → fewer pills → less sell pressure from emissions → natural floor on inflation

**The burn loop:**
- More pills spawned at high price tiers = harder to collect all 50 ASTRDS
- Uncollected allocation burns
- Burned supply reduces denominator → price rises further
- Burn feeds the flywheel

## The Quarter

- Cost per game: ~$0.25 in SOL
- Split (placeholder — percentages TBD once infra costs known):
  - 50% Operational (Railway, Helius, RPC, game server)
  - 30% Buyback (market buys ASTRDS from LP)
  - 20% LP (adds liquidity to ASTRDS/SOL pool)
- Split weights are on-chain and publicly visible

## The Flywheel

```
player pays quarter
       ↓
SOL → 30% buys ASTRDS off market, 20% adds LP
       ↓
pool value grows, burned supply shrinks
       ↓
price = pool / (21M - burned) rises
       ↓
higher tier → more pills spawn → harder to capture all 50
       ↓
uncollected pills burn → denominator shrinks further
       ↓
more incentive to play → more quarters
       ↓
repeat
```

Players can observe every step of this loop in real time.

## What Players See

The tokenomics overlay surfaces live economic state:
- Current derived price
- Current emission tier (pills per game, ASTRDS per pill right now)
- Circulating supply vs 21M cap
- Total burned (all time)
- LP pool depth
- Games played vs 420,000 total

Not a static info screen — a live view of the economy breathing.

## Operational Sustainability

Total inflow at full emission (420,000 games × $0.25): **$105,000**

At 50% operational split: **$52,500** over the full emission lifecycle.

Costs (all variable — to be confirmed):
- Railway (game server, future)
- Helius API
- Convex
- RPC
- Netlify

Operational split % to be adjusted once real infra costs are known. Structure does not change.

## Variables (All Admin-Adjustable)

Everything soft. Structure hard.

**On-chain (trustless — target state):**
- Quarter price in SOL
- Revenue split weights (operationalBps, buybackBps, lpBps)
- Hard supply cap (21M)
- Allocation per game (50 ASTRDS)
- Emission tier bands (price breakpoints)
- ASTRDS per pill at each tier
- Per-wallet cooldown / rate limiting

**Convex (pre-game-server):**
- Pill spawn logic per level
- Level scaling factor
- Price read (derived from on-chain LP + burn state)

## Roadmap Dependencies

- **Now (devnet):** Design the curve, keep all values soft/adjustable, build the tokenomics overlay as a live dashboard
- **Game server:** Required before emission is trustless — server attests gameplay, pills collected can't be spoofed
- **Mainnet:** Seed LP, wire Jupiter swap for buyback + LP additions, emission tiers on-chain
- **Full trustless:** All economic state on-chain. Convex handles only game state (sessions, scores, chat, leaderboard)

## Parked / Decided

**LP token custody → burn**
Burning LP tokens makes liquidity permanently locked and trustless. Nobody can rug it. Fits the north star — players can verify on-chain that liquidity can never be removed. Irreversibility is a feature, not a bug, for a token where the story is "nothing controlled by the team."

**Emission tier breakpoints → variable until on-chain hardening**
Current table is directionally correct but values are placeholders. Will be calibrated against real launch price and seeded liquidity. Keep soft until the on-chain contract design is settled.

**Revenue split → variable**
50/30/20 (operational/buyback/LP) is a placeholder. Additional slices may be added (community treasury, depositor incentive, dev fund). Percentages will be adjusted once the full story is clear. Structure of the split is on-chain and admin-adjustable — changing values does not require a program upgrade.

## Open Questions

- Death spiral protection — is the floor tier (5 pills, 10 ASTRDS/pill) enough to keep the game worth playing in a prolonged bear market, or do we need an additional mechanism
- Additional revenue split slices beyond operational/buyback/LP — candidates: community treasury, depositor incentive, dev fund
- Exact tier band price breakpoints — to be set at mainnet launch once seed liquidity amount is decided
- Game server architecture — required before emission can be fully trustless
