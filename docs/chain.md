# ASTRDS — On-Chain Reference

All addresses are **Solana devnet** unless otherwise noted.

---

## Program

| Name | Address |
|---|---|
| Space Vault Program | `4bRZK8XfziVhLCgvtRdFJyTgN6tXGSPJT8xfbtt1AxBB` |
| IDL Account | `4SQth9AnyuDe636K91kzBQVCz3mEFrEm6jmdJWJhVFZu` |

---

## Wallets

| Role | Address | Key location |
|---|---|---|
| Deployer / upgrade authority | `jrXCZwP8bxDnGs7ChD4F77We1K4J89R53SAVk5HsSoE` | `~/.config/solana/id.json` |
| Convex authority / treasury | `CNhWD1cXNaCMcjJmFcK25aFgV3ZTAFtyFDBvGfKZcpzF` | Convex env `PROGRAM_AUTHORITY_PRIVATE_KEY` |

**Deployer** — signs deployments, upgrades, and the one-time `initialize` call.  
**Convex authority** — the server-side keypair Convex uses to sign ed25519 claim authorizations. The on-chain program verifies these against `VaultConfig.convexAuthority`.

---

## Tokens

| Name | Mint | Standard |
|---|---|---|
| ASTRDS | `5sqKSHDKZr4KbNzj972PSfmEhtR9eLeBvv1nBRbeQAnB` | Token-2022 |

Mint authority and freeze authority are both held by the Convex authority wallet.

---

## Liquidity Pool — Meteora DAMM v2 (devnet)

| Field | Value |
|---|---|
| Pool address | `EQPzzbREwvEkZeJ7bvcasrz3tAsADtGAJxzTtcxiTCQG` |
| Pair | ASTRDS / SOL |
| Initial price | 0.000016 SOL per ASTRDS (~$0.0024 at seed, ~$50K FDV) |
| Seed | 50 ASTRDS + 0.0008 SOL |
| Fee tier | 1% fixed, dynamic fee enabled |
| Liquidity | Permanently locked |
| Owner | Deployer wallet `jrXCZwP8bxDnGs7ChD4F77We1K4J89R53SAVk5HsSoE` |

Note: devnet pool uses SOL as quote asset. Mainnet target is ASTRDS/USDC — see `docs/economy.md`.

---

## Program-Derived Accounts (PDAs)

PDAs are deterministic — derived from seeds + program ID. No keypair needed.

| Account | Seeds | Description |
|---|---|---|
| `VaultConfig` | `["vault-config"]` | `6zsWYibNCYYQJikHv8BHXRNynEACgFKsZPNXqWqBPbvv` — singleton config: weights, convex authority, wallet addresses |
| `DepositPool` | `["deposit-pool", depositor_pubkey, mint_pubkey]` | One per depositor+mint pair; tracks remaining balance; owns the vault ATA |
| `ClaimRecord` | `["claim-record", claim_id_bytes]` | One per claim; replay protection (claim ID is a random 32-byte value) |

Each `DepositPool` owns an associated token account (`vaultAta`) derived as:
`ATA(mint, depositPool, allowOwnerOffCurve=true, tokenProgram)`

### VaultConfig current values (devnet)

| Field | Value |
|---|---|
| authority | `jrXCZwP8bx...` (deployer) |
| convex_authority | `CNhWD1cXNa...` (Convex keypair) |
| operational_wallet | `jrXCZwP8bx...` (deployer — devnet placeholder) |
| operator_wallet | `jrXCZwP8bx...` (deployer — devnet placeholder) |
| buyback_wallet | `jrXCZwP8bx...` (deployer — devnet placeholder) |
| operational_bps | 5000 (50%) |
| operator_bps | 3000 (30%) |
| buyback_bps | 2000 (20%) |
| buyback_rate | 0 |

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  PLAYER                                                             │
│  Solana wallet (Phantom, Solflare, etc.)                            │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
              ┌────────────┴────────────┐
              │                        │
              ▼                        ▼
┌─────────────────────┐   ┌────────────────────────┐
│  GAME CLIENT        │   │  CONVEX BACKEND         │
│  React / Vite       │   │  (game state only)      │
│  Canvas game        │   │                         │
│  Wallet adapter     │   │  sessions, scores       │
│  spaceVault.ts      │   │  chat, leaderboard      │
│  (tx builders)      │   │  spawn tickets          │
└──────────┬──────────┘   │  collections            │
           │              │  claims table           │
           │              │  prepareClaims (ed25519)│
           │              └────────────┬────────────┘
           │                          │
           └──────────┬───────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│  SOLANA (devnet → mainnet)                                          │
│                                                                     │
│  ┌──────────────────────────┐   ┌───────────────────────────────┐  │
│  │  Space Vault Program     │   │  Meteora DAMM v2 Pool         │  │
│  │  (Anchor)                │   │  ASTRDS / USDC                │  │
│  │                          │   │  (mainnet target)             │  │
│  │  VaultConfig PDA         │   │                               │  │
│  │  DepositPool PDA(s)      │   │  LP tokens burned on mint     │  │
│  │  ClaimRecord PDA(s)      │   │  Liquidity permanently locked │  │
│  │                          │   │                               │  │
│  │  game_payment ───────────┼──►│  buyback + LP add per quarter │  │
│  │  deposit                 │   │                               │  │
│  │  claim (ed25519)         │   └───────────────────────────────┘  │
│  └──────────────────────────┘                                       │
│                                                                     │
│  ASTRDS Token-2022 Mint                                             │
│  Mint authority: Convex authority wallet                            │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Flow Diagrams

### Insert Quarter (game payment)

```
Player wallet
    │
    │  signs game_payment tx (~$0.25 SOL)
    │
    ▼
Space Vault Program — game_payment instruction
    │
    │  reads VaultConfig weights
    │
    ├──► operational_wallet   (operationalBps — infra costs)
    │
    ├──► buyback_wallet       (buybackBps)
    │         │
    │         └──► [mainnet] Jupiter swap SOL → ASTRDS
    │                    │
    │                    └──► DAMM v2 pool (price rises)
    │
    └──► lp_wallet            (lpBps)
              │
              └──► [mainnet] add USDC liquidity to DAMM v2 pool
                        │
                        └──► LP tokens burned on receipt (locked forever)
```

---

### ASTRDS Emission (per game)

```
Game starts
    │
    ▼
Convex reads DAMM v2 pool USDC value + total burned ASTRDS
    │
    │  price = pool_usdc / (21,000,000 - total_burned)
    │
    ▼
Emission tier lookup → pills spawned this game, ASTRDS per pill
    │
    │  Tier 1 (floor):  5 pills × 10 ASTRDS = 50 allocated
    │  Tier 2:         10 pills ×  5 ASTRDS = 50 allocated
    │  Tier 3:         25 pills ×  2 ASTRDS = 50 allocated
    │  Tier 4:         50 pills ×  1 ASTRDS = 50 allocated
    │  Tier 5 (ceil): 100 pills × 0.5 ASTRDS = 50 allocated
    │
    ▼
Pills spawn in asteroid field during gameplay
    │
    ├──► Player collects pill
    │         │
    │         ▼
    │    collectFromDeposit (Convex — atomic)
    │         └─ writes collections record (status: pending)
    │         └─ ASTRDS minted to player at game over
    │
    └──► Pill despawns uncollected
              │
              ▼
         ASTRDS allocation for that pill → burned
              └─ total_burned increases
              └─ denominator shrinks → price rises
```

---

### Token Deposit (Tokens in Space)

```
Depositor wallet
    │
    │  1. registerDepositIntent → Convex creates pending record
    │  2. buildSendToSpaceTransaction → registerPool + deposit instructions
    │  3. Depositor signs and sends on-chain
    │
    ▼
DepositPool PDA  (seeds: ["deposit-pool", depositor, mint])
    │
    └─ vaultAta  (ATA owned by DepositPool PDA — not treasury wallet)
          │
          └─ deposited tokens land here
    │
    ├──► confirmDepositFromChain mutation
    │         └─ activates Convex record with poolAddress
    │
    └──► verifyAndConfirmDeposit action (parallel)
              └─ reads tx.meta.postTokenBalances - preTokenBalances
              └─ overwrites Convex amount with verified on-chain value
              └─ client-provided amounts are never trusted
```

---

### In-Game Token Spawn → Collection → Claim

```
SPAWN
──────
engineStore.spawnToken()
    │
    ▼
requestSpawnTicket (Convex mutation)
    ├─ validates: active session, wallet paid, cooldown elapsed
    ├─ issues spawnTickets record (60s TTL)
    └─ if valid ticket → Token entity spawns client-side

COLLECTION
──────────
Ship collides with Token entity
    │
    ▼
collectFromDeposit (Convex mutation — atomic, serialized per pool)
    ├─ validates ticket + marks used
    ├─ decrements remainingAmount in DepositPool record
    └─ writes persistent collections record  (status: pending)

CLAIM  (game over screen or AccountScreen)
──────
prepareClaims (Convex action)
    ├─ groups pending collections by deposit
    ├─ signs {player, pool, amount, claimId, expiry} with convex_authority ed25519
    └─ returns signed claim data to client
    │
    ▼
buildClaimTransaction (client — spaceVault.ts, one tx per claim)
    ├─ Ed25519Program.createInstructionWithPublicKey(convexAuthority, message, sig)
    └─ + claim instruction
    │
    ▼
claim instruction (on-chain — Space Vault Program)
    ├─ verifies ed25519 pre-instruction against VaultConfig.convexAuthority
    ├─ creates ClaimRecord PDA  (replay protection — one per claimId)
    └─ transfers tokens: vaultAta → player ATA  (init_if_needed)
    │
    ▼
Player wallet holds claimed token
    │
    ▼
finalizeClaim mutation (Convex)
    ├─ marks collections as claimed
    └─ writes to claims table (with tx signature)
```

---

### Drain Detection / Reconcile

```
Helius webhook fires on any tx touching treasury wallet
    │
    ├──► Inbound transfer → deposit flow (above)
    │
    └──► Outbound transfer
              │
              ├─ found in claims table? → expected, ignore
              │
              └─ NOT in claims table → unknown drain
                        │
                        ▼
                   reconcilePool action
                        ├─ fetches actual on-chain DepositPool PDA balance
                        └─ caps Convex remainingAmount to on-chain reality

Hourly cron: reconcileAllPools
    └─ same reconcile logic across all active pools
```

---

### Economy Pricing Loop (mainnet target)

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│   DAMM v2 Pool state (on-chain, readable by anyone)         │
│                                                              │
│   pool_usdc_value ──┐                                        │
│                     ├──► price = pool_usdc / (21M - burned) │
│   total_burned  ────┘              │                         │
│                                    │                         │
│                          emission tier lookup                │
│                                    │                         │
│                    ┌───────────────┴──────────────┐         │
│                    │                              │         │
│              pills spawn                    ASTRDS/pill     │
│                    │                              │         │
│              player plays                         │         │
│                    │                              │         │
│         ┌──────────┴──────────┐                  │         │
│         │                     │                  │         │
│      collected             not collected          │         │
│         │                     │                  │         │
│    minted to player         burned                │         │
│                                │                  │         │
│                        total_burned grows         │         │
│                                │                  │         │
│                        price rises ───────────────┘         │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## Convex Environment Variables

| Key | Purpose |
|---|---|
| `PROGRAM_AUTHORITY_PRIVATE_KEY` | JSON array — Convex authority keypair (ASTRDS minting + ed25519 claim signing) |
| `SOLANA_RPC_ENDPOINT` | RPC used by Convex actions |
| `HELIUS_WEBHOOK_SECRET` | Shared secret for webhook validation |

---

## Explorer Links

- [Program on Orb Markets](https://orbmarkets.io/address/4bRZK8XfziVhLCgvtRdFJyTgN6tXGSPJT8xfbtt1AxBB?cluster=devnet)
- [ASTRDS Token Mint](https://orbmarkets.io/address/5sqKSHDKZr4KbNzj972PSfmEhtR9eLeBvv1nBRbeQAnB?cluster=devnet)
- [Treasury / Convex Authority Wallet](https://orbmarkets.io/address/CNhWD1cXNaCMcjJmFcK25aFgV3ZTAFtyFDBvGfKZcpzF?cluster=devnet)
- [Meteora devnet](https://devnet.meteora.ag/)
- [Meteora DAMM v2 docs](https://docs.meteora.ag/developer-guide/quick-launch/damm-v2-launch-pool)
- [ASTRDS/SOL Pool (devnet)](https://orbmarkets.io/address/EQPzzbREwvEkZeJ7bvcasrz3tAsADtGAJxzTtcxiTCQG?cluster=devnet)
