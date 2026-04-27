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

Mint authority is held by the **VaultConfig PDA** (`6zsWYibNCYYQJikHv8BHXRNynEACgFKsZPNXqWqBPbvv`). Minting can only happen through the on-chain `mint_astrds` instruction. Freeze authority is held by the Convex authority wallet (`CNhWD1cXNaCMcjJmFcK25aFgV3ZTAFtyFDBvGfKZcpzF`).

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

Pool price is read as `sol_reserve / astrds_reserve`. SOL/USD is fetched from Jupiter API (60s cache) to derive USD-denominated emission tiers. See `docs/economy.md` for the full pricing model.

---

## Program-Derived Accounts (PDAs)

PDAs are deterministic — derived from seeds + program ID. No keypair needed.

| Account | Seeds | Description |
|---|---|---|
| `VaultConfig` | `["vault-config"]` | `6zsWYibNCYYQJikHv8BHXRNynEACgFKsZPNXqWqBPbvv` — singleton config: weights, convex authority, wallet addresses |
| `BuybackVault` | `["buyback-vault"]` | `8wBQd5e9yym7A3xR9wN39Wfv5SymdwmcADxVWCedgf7g` — system account PDA that accumulates the `buyback_bps` SOL slice from every game payment; drained by `crank_liquidity` |
| `MeteoraPositionNftMint` | `["meteora-position-mint"]` | `FAsVQSWkV8P3j1WsdsWdG7zE45i1tgX346Dm83NPCFj8` — deterministic NFT mint for the vault's Meteora LP position; controlled by this program |
| `DepositPool` | `["deposit-pool", depositor_pubkey, mint_pubkey]` | One per depositor+mint pair; tracks remaining balance; owns the vault ATA |
| `ClaimRecord` | `["claim-record", claim_id_bytes]` | One per space-token claim; replay protection (claim ID is a random 32-byte value) |
| `MintRecord` | `["mint-record", session_id_bytes]` | One per game session; replay protection for `mint_astrds` (session ID is the Convex game session ID, UTF-8 encoded, zero-padded to 32 bytes) |

Each `DepositPool` owns an associated token account (`vaultAta`) derived as:
`ATA(mint, depositPool, allowOwnerOffCurve=true, tokenProgram)`

### VaultConfig current values (devnet)

| Field | Value |
|---|---|
| authority | `jrXCZwP8bx...` (deployer) |
| convex_authority | `CNhWD1cXNa...` (Convex keypair) |
| operational_wallet | `jrXCZwP8bx...` (deployer — devnet placeholder) |
| operator_wallet | `jrXCZwP8bx...` (deployer — devnet placeholder) |
| operational_bps | 5000 (50%) |
| operator_bps | 3000 (30%) |
| buyback_bps | 2000 (20%) — routes to `BuybackVault` PDA; flushed to Meteora LP by `crank_liquidity` |
| meteora_pool | `EQPzzbREwvEkZeJ7bvcasrz3tAsADtGAJxzTtcxiTCQG` — Meteora DAMM v2 ASTRDS/SOL pool; CPI target for `crank_liquidity` |

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  PLAYER                                                             │
│  Solana wallet (Phantom, Solflare, etc.)                            │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
              ┌────────────┴──────────────────┐
              │                               │
              ▼                               ▼
┌─────────────────────┐        ┌─────────────────────────┐
│  GAME CLIENT        │        │  GAME SERVER            │
│  React / Vite       │◄──ws──►│  Node.js / Railway      │
│  Canvas renderer    │        │  30 tick/s auth. loop   │
│  Wallet adapter     │        │  SessionHandler.ts      │
│  spaceVault.ts      │        │  simulation.ts          │
│  (tx builders)      │        │  enforces emission tier │
└──────────┬──────────┘        └────────────┬────────────┘
           │                                │
           │              ┌─────────────────┴──────────┐
           │              │  CONVEX BACKEND             │
           │              │  (game state only)          │
           │              │                             │
           │              │  sessions, scores, chat     │
           │              │  spawn tickets              │
           │              │  collections, claims table  │
           │              │  prepareClaims (ed25519)    │
           │              └─────────────────┬───────────┘
           │                                │
           └──────────────┬─────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│  SOLANA (devnet → mainnet)                                          │
│                                                                     │
│  ┌──────────────────────────┐   ┌───────────────────────────────┐  │
│  │  Space Vault Program     │   │  Meteora DAMM v2 Pool         │  │
│  │  (Anchor)                │   │  ASTRDS / SOL                 │  │
│  │                          │   │                               │  │
│  │  VaultConfig PDA         │   │  LP tokens → vault PDA        │  │
│  │  BuybackVault PDA        │   │  (permanently locked)         │  │
│  │  DepositPool PDA(s)      │   │                               │  │
│  │  ClaimRecord PDA(s)      │   │                               │  │
│  │                          │   │                               │  │
│  │  game_payment            │   │  two-sided SOL+ASTRDS LP add  │  │
│  │  crank_liquidity ─CPI───►│   │  position permanently locked  │  │
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
Space Vault Program — game_payment instruction (6 accounts)
    │
    │  reads VaultConfig weights
    │
    ├──► operational_wallet   (operationalBps — infra costs)
    │
    ├──► operator_wallet      (operatorBps — game server operator fee)
    │
    └──► BuybackVault PDA     (buybackBps — accumulates SOL for LP)
              │
              │  SOL sits here until a cranker calls crank_liquidity
              │  (see below — permissionless, anyone can crank)
```

---

### Crank Liquidity

```
Cranker wallet (anyone — permissionless)
    │
    │  signs crank_liquidity tx with amount to flush
    │
    ▼
Space Vault Program — crank_liquidity instruction (21 accounts)
    │
    │  1. transfer `amount` SOL: BuybackVault → vault_config WSOL ATA
    │  2. sync_native — WSOL balance updated
    │  3. if position does not exist → create_position CPI (Meteora)
    │  4. swap half of SOL → ASTRDS: SwapCpi (vault_config signs)
    │  5. compute liquidity_delta from current vault balances
    │  6. AddLiquidityCpi — deposit both sides into position
    │  7. PermanentLockPositionCpi — lock liquidity forever
    │
    ▼
Meteora DAMM v2 pool (EQPzzbREwvEkZeJ7bvcasrz3tAsADtGAJxzTtcxiTCQG)
    │
    └──► sol_reserve grows → price rises
         LP position locked forever in vault position PDA
```

---

### ASTRDS Emission (per game)

```
Game session starts
    │
    ▼
Game server reads DAMM v2 pool at session start
    │
    │  price_sol = sol_reserve / astrds_reserve   (live from pool)
    │  price_usd = price_sol × sol_usd_price       (Jupiter API, 60s cache)
    │
    ▼
Emission tier lookup → pills spawned this game, ASTRDS per pill
    │
    │  Tier 1 (floor):   5 pills × 10 ASTRDS = 50 allocated
    │  Tier 2:          10 pills ×  5 ASTRDS = 50 allocated
    │  Tier 3:          25 pills ×  2 ASTRDS = 50 allocated
    │  Tier 4:          50 pills ×  1 ASTRDS = 50 allocated
    │  Tier 5 (ceil):  100 pills × 0.5 ASTRDS = 50 allocated
    │
    │  Tier and pill cap locked for the duration of the session.
    │  Client cannot influence emission rate.
    │
    ▼
Pills spawn in asteroid field during gameplay (server-authoritative)
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
              └─ circulating supply shrinks → sell pressure falls
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
Game server calls requestSpawnTicket (Convex mutation)
    ├─ validates: active session, wallet paid, cooldown elapsed
    ├─ issues spawnTickets record (60s TTL)
    └─ if valid ticket → game server injects Token entity into simulation

COLLECTION
──────────
Ship collides with Token entity (server-authoritative detection)
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

### Economy Pricing Loop

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│   DAMM v2 Pool state (on-chain, readable by anyone)         │
│                                                              │
│   sol_reserve ──────┐                                        │
│                     ├──► price_sol = sol_reserve /           │
│   astrds_reserve ───┘              astrds_reserve            │
│                                    │                         │
│                        × sol_usd_price (Jupiter API)         │
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
│                    circulating supply shrinks      │         │
│                    sell pressure falls             │         │
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
