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

## Flow Diagrams

### Insert Quarter (game payment)

```
Player wallet
    │  signs SOL transfer tx (≈$0.25 at current price)
    ▼
game_payment instruction
    │
    ├─ 50% ──► operational_wallet
    ├─ 30% ──► operator_wallet
    └─ 20% ──► buyback_wallet
```

### Token Deposit (Tokens in Space)

```
Depositor wallet
    │  1. registerDepositIntent → Convex creates pending record
    │  2. buildSendToSpaceTransaction → registerPool + deposit instructions
    │  3. Player signs and sends on-chain
    ▼
DepositPool PDA (depositor + mint)
    │  └─ vaultAta (ATA owned by DepositPool PDA)
    │       └─ tokens land here, not in treasury wallet
    │
    ├─ confirmDepositFromChain mutation → activates Convex record with poolAddress
    │
    └─ verifyAndConfirmDeposit action (parallel)
           └─ reads tx.meta.postTokenBalances - preTokenBalances
           └─ overwrites Convex amount with verified on-chain value
```

### In-Game Token Spawn → Collection → Claim

```
Spawn:
    engineStore.spawnToken()
    │
    ▼
requestSpawnTicket (Convex mutation)
    └─ validates: active session, paid, per-player cooldown elapsed
    └─ issues spawnTickets record (60s TTL)
    └─ if valid ticket returned → Token entity spawned client-side

Collection:
    Ship-token collision
    │
    ▼
collectFromDeposit (Convex mutation — atomic, serialized)
    └─ validates + marks ticket used
    └─ decrements remainingAmount in DepositPool record
    └─ writes persistent collections record (status: pending)

Claim (game over screen or AccountScreen):
    │
    ▼
prepareClaims (Convex action)
    │  1. Groups pending collections by deposit
    │  2. Signs {player, pool, amount, claimId, expiry} with convex_authority
    │  3. Returns signed claim data to client
    ▼
buildClaimTransaction (client — spaceVault.ts, per claim)
    │  Ed25519Program.createInstructionWithPublicKey(convexAuthority, message, sig)
    │  + claim instruction
    ▼
claim instruction (on-chain)
    │  Verifies ed25519 pre-instruction against VaultConfig.convexAuthority
    │  Creates ClaimRecord PDA (replay protection)
    │  Transfers tokens: vaultAta → player ATA (init_if_needed)
    ▼
Player's wallet now holds the claimed token
    │
    ▼
finalizeClaim mutation
    └─ marks collections as claimed
    └─ writes to claims table (with tx signature)
```

### Drain Detection / Reconcile

```
Helius webhook fires on any tx touching treasury wallet
    │
    ├─ Inbound (deposit): handled by deposit flow above
    │
    └─ Outbound (transfer out):
           Is it in the claims table? → expected, ignore
           Not in claims table? → unknown drain
               │
               ▼
           reconcilePool action
               └─ fetches actual on-chain pool PDA remaining balance
               └─ caps DepositPool.remainingAmount to on-chain reality

Hourly cron: reconcileAllPools
    └─ same reconcile logic across all active pools
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
