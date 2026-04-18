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
**Convex authority** — the server-side keypair Convex uses to sign claim authorizations and execute SPL transfers. Also holds deposited space tokens in its associated token accounts.

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
| `DepositPool` | `["deposit-pool", depositor_pubkey, mint_pubkey]` | One per depositor+mint pair; tracks remaining balance |
| `ClaimRecord` | `["claim-record", claim_id_bytes]` | One per claim; replay protection (claim ID is a UUID hash) |

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
    │  2. signs SPL transfer tx (any token amount)
    │  3. submitDepositTransaction → Convex stores txSignature
    ▼
Convex authority token account (for that mint)
    │
    Helius webhook fires on confirmed tx
    │  OR depositor calls verifyAndConfirmDeposit manually
    ▼
DepositPool PDA (depositor + mint)
    └─ totalAmount set from on-chain tx.meta (never client input)
    └─ remainingAmount = totalAmount (decremented as players collect)
```

### In-Game Token Collection → Claim

```
Player collects token pill in game
    │
    ▼
collectFromDeposit (Convex mutation — atomic, serialized)
    └─ remainingAmount decremented in DepositPool

Game over screen — player clicks Claim
    │
    ▼
Convex action: executeClaimTransfer
    │  1. Derives claim_id (UUID → sha256 hash)
    │  2. Signs {claim_id, player, mint, amount} with convex_authority keypair
    │  3. Builds ed25519 pre-instruction + claim instruction
    ▼
claim instruction (on-chain)
    │  Verifies ed25519 signature against convex_authority in VaultConfig
    │  Creates ClaimRecord PDA (replay protection)
    │  Transfers tokens from Convex authority ATA → player ATA
    ▼
Player's wallet now holds the claimed token
    └─ claim written to Convex `claims` table
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
               └─ fetches actual on-chain token balance
               └─ caps DepositPool.remainingAmount to on-chain reality

Hourly cron: reconcileAllPools
    └─ same reconcile logic across all active pools
```

---

## Convex Environment Variables

| Key | Purpose |
|---|---|
| `PROGRAM_AUTHORITY_PRIVATE_KEY` | JSON array — Convex authority keypair (minting + claims) |
| `SOLANA_RPC_ENDPOINT` | RPC used by Convex actions |
| `HELIUS_WEBHOOK_SECRET` | Shared secret for webhook validation |

---

## Explorer Links

- [Program on Solana Explorer](https://explorer.solana.com/address/4bRZK8XfziVhLCgvtRdFJyTgN6tXGSPJT8xfbtt1AxBB?cluster=devnet)
- [ASTRDS Token Mint](https://explorer.solana.com/address/5sqKSHDKZr4KbNzj972PSfmEhtR9eLeBvv1nBRbeQAnB?cluster=devnet)
- [Treasury Wallet](https://explorer.solana.com/address/CNhWD1cXNaCMcjJmFcK25aFgV3ZTAFtyFDBvGfKZcpzF?cluster=devnet)
