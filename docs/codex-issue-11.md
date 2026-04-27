# Codex Task: Issue #11 — Meteora DAMM v2 CPI in `game_payment`

## What you are doing

Implementing the on-chain buyback/liquidity mechanism for the ASTRDS game. When a player pays to play ("insert quarter"), a portion of the SOL (`pool_bps = 2000 = 20%`) currently goes to a treasury wallet placeholder. The goal is to route that SOL directly into a Meteora DAMM v2 (constant-product AMM) pool as a single-sided SOL deposit, within the same `game_payment` transaction. LP tokens land in the vault config PDA and are locked forever. This deepens ASTRDS/SOL liquidity automatically every time someone plays.

This is purely on-chain program + TypeScript client work. No game logic, Convex, or React changes needed.

---

## Repo structure

```
/
  programs/space-vault-program/src/lib.rs   — the Anchor program (change this)
  app/src/lib/idl/space_vault_program.json  — IDL used by the frontend (update after rebuild)
  app/src/lib/spaceVault.ts                 — TypeScript tx builders (update buildGamePaymentTransaction)
  tests/space-vault-program.ts              — Anchor test suite (add a test for the Meteora path)
  Anchor.toml                               — cluster: devnet, wallet: ~/.config/solana/id.json
```

Anchor version: **0.32.1**  
Cargo.toml has no Meteora dependency yet — you will add one.

---

## On-chain state today

**Program ID (already deployed, upgradeable):**
```
4bRZK8XfziVhLCgvtRdFJyTgN6tXGSPJT8xfbtt1AxBB
```

**VaultConfig PDA** (seeds: `["vault-config"]`):
```
6zsWYibNCYYQJikHv8BHXRNynEACgFKsZPNXqWqBPbvv
```
Current layout:
```rust
pub struct VaultConfig {
    pub authority: Pubkey,          // jrXCZwP8bxDnGs7ChD4F77We1K4J89R53SAVk5HsSoE (deployer)
    pub payment_weights: PaymentWeights,  // operational 5000, operator 3000, buyback 2000 bps
    pub buyback_rate: u64,          // unused — zero
    pub convex_authority: Pubkey,   // CNhWD1cXNaCMcjJmFcK25aFgV3ZTAFtyFDBvGfKZcpzF
    pub operational_wallet: Pubkey, // jrXCZwP8bx... (devnet placeholder)
    pub operator_wallet: Pubkey,    // jrXCZwP8bx... (devnet placeholder)
    pub buyback_wallet: Pubkey,     // jrXCZwP8bx... (placeholder — replace with meteora_pool)
    pub bump: u8,
}
```

**Meteora DAMM v2 pool (devnet):**
```
EQPzzbREwvEkZeJ7bvcasrz3tAsADtGAJxzTtcxiTCQG
```
Pair: ASTRDS / SOL  
ASTRDS mint: `5sqKSHDKZr4KbNzj972PSfmEhtR9eLeBvv1nBRbeQAnB` (Token-2022)  
The pool was created on devnet Meteora UI. Liquidity is permanently locked.

---

## Current `game_payment` instruction (Rust)

```rust
pub fn game_payment(ctx: Context<GamePayment>, amount: u64) -> Result<()> {
    require!(amount > 0, SpaceVaultError::InvalidAmount);
    let weights = ctx.accounts.vault_config.payment_weights;
    weights.validate()?;

    let operational_amount = ((amount as u128) * (weights.operational_bps as u128) / 10_000) as u64;
    let operator_amount = ((amount as u128) * (weights.operator_bps as u128) / 10_000) as u64;
    let buyback_amount = amount
        .checked_sub(operational_amount)
        .and_then(|r| r.checked_sub(operator_amount))
        .ok_or(SpaceVaultError::MathOverflow)?;

    transfer_sol(&ctx.accounts.player, &ctx.accounts.operational_wallet, &ctx.accounts.system_program, operational_amount)?;
    transfer_sol(&ctx.accounts.player, &ctx.accounts.operator_wallet, &ctx.accounts.system_program, operator_amount)?;
    transfer_sol(&ctx.accounts.player, &ctx.accounts.buyback_wallet, &ctx.accounts.system_program, buyback_amount)?;
    Ok(())
}

#[derive(Accounts)]
pub struct GamePayment<'info> {
    #[account(mut)] pub player: Signer<'info>,
    #[account(seeds = [VAULT_CONFIG_SEED], bump = vault_config.bump)]
    pub vault_config: Account<'info, VaultConfig>,
    /// CHECK: address = vault_config.operational_wallet
    #[account(mut, address = vault_config.operational_wallet)] pub operational_wallet: UncheckedAccount<'info>,
    /// CHECK: address = vault_config.operator_wallet
    #[account(mut, address = vault_config.operator_wallet)] pub operator_wallet: UncheckedAccount<'info>,
    /// CHECK: address = vault_config.buyback_wallet
    #[account(mut, address = vault_config.buyback_wallet)] pub buyback_wallet: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}
```

---

## What needs to change

### 1. Find the Meteora DAMM v2 program ID

Run:
```bash
solana account EQPzzbREwvEkZeJ7bvcasrz3tAsADtGAJxzTtcxiTCQG --url devnet
```
The `Owner` field is the Meteora cp-amm program ID. You can also fetch the IDL:
```bash
anchor idl fetch <METEORA_PROGRAM_ID> --provider.cluster devnet
```

Meteora publishes their cp-amm crate. Check crates.io for `meteora-cp-swap` or `meteora-damm`. The crate should expose CPI-compatible types when built with the `cpi` feature.

### 2. Add Meteora crate to Cargo.toml

```toml
[dependencies]
anchor-lang = { version = "0.32.1", features = ["init-if-needed"] }
anchor-spl = "0.32.1"
meteora-cp-swap = { version = "<latest>", features = ["cpi"] }
# or whatever the correct crate + feature name is
```

If no crate exists, fall back to a raw CPI with the discriminator. Instructions below.

### 3. Update `VaultConfig` — rename fields in place

**This is a same-size rename, NOT a breaking layout change.** The `buyback_wallet` slot (32 bytes at a fixed offset) becomes `meteora_pool`. `buyback_rate` becomes `_reserved` (or can stay named but unused).

```rust
pub struct VaultConfig {
    pub authority: Pubkey,
    pub payment_weights: PaymentWeights,
    pub _reserved: u64,            // was buyback_rate — keep for layout compatibility
    pub convex_authority: Pubkey,
    pub operational_wallet: Pubkey,
    pub operator_wallet: Pubkey,
    pub meteora_pool: Pubkey,      // was buyback_wallet — same offset, same size
    pub bump: u8,
}
```

Because the byte layout is identical, the existing on-chain VaultConfig account remains readable. You just need to call `set_meteora_pool` (new instruction below) to write the real pool address into that slot.

### 4. Add `set_meteora_pool` instruction

Authority-gated, updates the `meteora_pool` field. Call this once after deployment with the deployer keypair.

```rust
pub fn set_meteora_pool(ctx: Context<SetMeteoraPool>, meteora_pool: Pubkey) -> Result<()> {
    ctx.accounts.vault_config.meteora_pool = meteora_pool;
    Ok(())
}

#[derive(Accounts)]
pub struct SetMeteoraPool<'info> {
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [VAULT_CONFIG_SEED],
        bump = vault_config.bump,
        has_one = authority
    )]
    pub vault_config: Account<'info, VaultConfig>,
}
```

### 5. Implement the Meteora CPI in `game_payment`

The flow:
1. Transfer `operational_amount` SOL from player → operational_wallet (unchanged)
2. Transfer `operator_amount` SOL from player → operator_wallet (unchanged)
3. Transfer `pool_amount` SOL from player → vault_config PDA (new — loads the PDA's lamports)
4. CPI: vault_config PDA calls Meteora's single-sided SOL deposit with `pool_amount` lamports
5. LP tokens from Meteora land in `vault_config_lp_ata` (ATA owned by vault_config PDA — locked forever, no withdrawal instruction)

**For step 3:** SOL transfer from player to vault_config uses the existing `transfer_sol` helper — just change the destination. Alternatively use direct lamport adjustment after verifying account is owned by the program.

**For step 4 (Meteora CPI):** 

If using the Meteora crate with `cpi` feature:
```rust
use meteora_cp_swap::cpi::{self, accounts::AddLiquiditySingleSide};
// (or whatever the actual module path is — check the crate docs)

let signer_seeds: &[&[u8]] = &[VAULT_CONFIG_SEED, &[ctx.accounts.vault_config.bump]];
let signer_binding = [signer_seeds];
cpi::add_liquidity_single_side(
    CpiContext::new_with_signer(
        ctx.accounts.meteora_program.to_account_info(),
        AddLiquiditySingleSide {
            pool: ctx.accounts.meteora_pool.to_account_info(),
            user: ctx.accounts.vault_config.to_account_info(),
            // ... all required accounts from the Meteora IDL
        },
        &signer_binding,
    ),
    pool_amount,
    0, // minimum LP out — accept any amount on devnet
)?;
```

If no crate with CPI feature is available, use a raw instruction:
```rust
use anchor_lang::solana_program::instruction::Instruction;

let discriminator = <8-byte discriminator from Meteora IDL>;
let mut data = discriminator.to_vec();
data.extend_from_slice(&pool_amount.to_le_bytes());
data.extend_from_slice(&0u64.to_le_bytes()); // min_lp_out

let accounts = vec![
    // ordered exactly as the Meteora IDL specifies
    AccountMeta::new(ctx.accounts.meteora_pool.key(), false),
    AccountMeta::new(ctx.accounts.vault_config.key(), true),   // user/depositor (PDA signer)
    // ... etc
];

let ix = Instruction {
    program_id: ctx.accounts.meteora_program.key(),
    accounts,
    data,
};

let signer_seeds: &[&[u8]] = &[VAULT_CONFIG_SEED, &[ctx.accounts.vault_config.bump]];
anchor_lang::solana_program::program::invoke_signed(
    &ix,
    &[
        ctx.accounts.meteora_pool.to_account_info(),
        ctx.accounts.vault_config.to_account_info(),
        // ... all accounts in the same order
    ],
    &[signer_seeds],
)?;
```

**Updated `GamePayment` accounts struct** (add whatever Meteora requires):
```rust
#[derive(Accounts)]
pub struct GamePayment<'info> {
    #[account(mut)] pub player: Signer<'info>,
    #[account(mut, seeds = [VAULT_CONFIG_SEED], bump = vault_config.bump)]
    pub vault_config: Account<'info, VaultConfig>,  // now mut — receives SOL before Meteora CPI
    /// CHECK: address = vault_config.operational_wallet
    #[account(mut, address = vault_config.operational_wallet)] pub operational_wallet: UncheckedAccount<'info>,
    /// CHECK: address = vault_config.operator_wallet
    #[account(mut, address = vault_config.operator_wallet)] pub operator_wallet: UncheckedAccount<'info>,
    /// CHECK: address = vault_config.meteora_pool
    #[account(mut, address = vault_config.meteora_pool)] pub meteora_pool: UncheckedAccount<'info>,
    // LP token mint for the pool:
    #[account(mut)] pub lp_mint: InterfaceAccount<'info, Mint>,
    // vault_config's LP token account (ATA, init_if_needed — locked LP goes here):
    #[account(
        init_if_needed,
        payer = player,
        associated_token::mint = lp_mint,
        associated_token::authority = vault_config,
    )]
    pub vault_config_lp_ata: InterfaceAccount<'info, TokenAccount>,
    // Pool's SOL vault and ASTRDS vault (from Meteora pool state):
    #[account(mut)] pub pool_sol_vault: UncheckedAccount<'info>,   // adjust type as needed
    #[account(mut)] pub pool_astrds_vault: UncheckedAccount<'info>,
    /// CHECK: Meteora DAMM v2 program
    pub meteora_program: UncheckedAccount<'info>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}
```

> **Note:** The exact accounts required by Meteora's instruction may differ from the above skeleton. Derive them from the actual Meteora IDL you fetch in step 1.

---

## Frontend changes (`app/src/lib/spaceVault.ts`)

After the program changes, update `buildGamePaymentTransaction`:

```typescript
// Current (remove buybackWallet, add Meteora accounts):
export const buildGamePaymentTransaction = async ({
  connection, player, lamports,
}: { connection: Connection; player: PublicKey; lamports: number }) => {
  const program = getSpaceVaultProgram(connection, player)
  const [vaultConfig] = findVaultConfigPda()
  const config = await fetchVaultConfig(connection)

  // Derive LP mint + pool vaults from the Meteora pool account on-chain.
  // Use the same raw-read helper pattern already in emissionTiers.ts.
  const meteoraPool = config.meteoraPool  // previously config.buybackWallet
  // ... read pool account, derive vault addresses

  const tx = new Transaction().add(
    await program.methods
      .gamePayment(new BN(lamports))
      .accounts({
        player,
        vaultConfig,
        operationalWallet: config.operationalWallet,
        operatorWallet: config.operatorWallet,
        meteoraPool,
        lpMint,
        vaultConfigLpAta,
        poolSolVault,
        poolAstrdsVault,
        meteoraProgram: METEORA_PROGRAM_ID,
        // ... rest of accounts
      })
      .instruction()
  )
  // ...
}
```

Note: `fetchVaultConfig` currently returns `buybackWallet`. After renaming the field in the IDL, it will return `meteoraPool`. Update all field references in `spaceVault.ts` accordingly.

---

## IDL update

After building (`anchor build`), copy the generated IDL to the frontend:

```bash
cp target/idl/space_vault_program.json app/src/lib/idl/space_vault_program.json
```

The IDL is also used for TypeScript types. If you need the TypeScript type file, regenerate it:
```bash
cp target/types/space_vault_program.ts app/src/lib/idl/space_vault_program.ts
# or update app/src/lib/idl/space_vault_program.d.ts if that exists
```

The TypeScript type used by the frontend is `SpaceVaultProgram` imported from `@/lib/idl/space_vault_program`.

---

## Test to add

In `tests/space-vault-program.ts`, add a test for the new `game_payment` path that verifies:
1. LP tokens land in `vault_config_lp_ata` after the call
2. The operational and operator wallets receive their correct SOL amounts
3. The Meteora pool receives the `pool_bps` portion of SOL

If testing against a live Meteora devnet pool is too complex for the unit test, at minimum test that the old `buyback_wallet` path is gone and the new accounts are validated correctly. Mock the Meteora CPI if needed by verifying the intermediate SOL transfer to vault_config PDA succeeds.

---

## Deploy checklist (after changes compile)

```bash
# 1. Build
anchor build

# 2. Upgrade the existing program (NOT a fresh deploy — same program ID)
anchor upgrade target/deploy/space_vault_program.so \
  --program-id 4bRZK8XfziVhLCgvtRdFJyTgN6tXGSPJT8xfbtt1AxBB \
  --provider.cluster devnet

# 3. Set the Meteora pool address in VaultConfig
# (write a one-off script using the set_meteora_pool instruction,
#  signing with the deployer wallet ~/.config/solana/id.json)
# Pool address: EQPzzbREwvEkZeJ7bvcasrz3tAsADtGAJxzTtcxiTCQG

# 4. Update the IDL on-chain (optional but good practice)
anchor idl upgrade \
  --filepath target/idl/space_vault_program.json \
  4bRZK8XfziVhLCgvtRdFJyTgN6tXGSPJT8xfbtt1AxBB \
  --provider.cluster devnet
```

---

## What must NOT break

- `register_pool`, `deposit`, `claim` instructions — untouched
- `claim` ed25519 verification — untouched
- `initialize` and `set_weights` — keep working (minor signature update if you remove `buyback_rate` param)
- Frontend `buildClaimTransaction`, `buildSendToSpaceTransaction` — untouched
- Convex backend — no changes required
- The pool at `EQPzzbREwvEkZeJ7bvcasrz3tAsADtGAJxzTtcxiTCQG` is the authoritative liquidity pool for ASTRDS emission tier pricing (read by `server/src/game/emissionTiers.ts`) — don't touch it

---

## Key addresses

| Thing | Address |
|---|---|
| Space Vault Program | `4bRZK8XfziVhLCgvtRdFJyTgN6tXGSPJT8xfbtt1AxBB` |
| VaultConfig PDA | `6zsWYibNCYYQJikHv8BHXRNynEACgFKsZPNXqWqBPbvv` |
| Deployer / authority | `jrXCZwP8bxDnGs7ChD4F77We1K4J89R53SAVk5HsSoE` |
| Convex authority | `CNhWD1cXNaCMcjJmFcK25aFgV3ZTAFtyFDBvGfKZcpzF` |
| ASTRDS mint | `5sqKSHDKZr4KbNzj972PSfmEhtR9eLeBvv1nBRbeQAnB` (Token-2022) |
| Meteora pool | `EQPzzbREwvEkZeJ7bvcasrz3tAsADtGAJxzTtcxiTCQG` |
| Meteora program ID | **run `solana account EQPzzbREwvEkZeJ7bvcasrz3tAsADtGAJxzTtcxiTCQG --url devnet` to get Owner** |

---

## Economics context (why this matters)

Every `game_payment` transaction (~$0.25 SOL) routes 20% into the Meteora pool. A single-sided SOL deposit into a constant-product AMM causes the pool to internally rebalance (half the SOL effectively buys ASTRDS), increasing the SOL reserve and ASTRDS price. The resulting LP tokens go to the vault config PDA with no withdrawal instruction — permanently locked. This means:

- SOL reserve grows every game → ASTRDS price rises
- Rising price → higher emission tier → fewer pills spawn → less ASTRDS minted → less inflation
- The on-chain price oracle (pool ratio) directly governs emission, without any off-chain oracle

No external keepers, no admin intervention. This closes the loop on the ASTRDS tokenomics model.
