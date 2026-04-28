use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    instruction::Instruction,
    program::invoke,
    sysvar::instructions::{load_current_index_checked, load_instruction_at_checked},
};
use anchor_lang::system_program::{self, Transfer as SolTransfer};
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token;
use anchor_spl::token_interface::{self, Mint, MintTo, TokenAccount, TokenInterface, TransferChecked};
use meteora_damm_rust_sdk::accounts::Pool as MeteoraPool;
use meteora_damm_rust_sdk::instructions::{
    AddLiquidityCpi, AddLiquidityCpiAccounts, AddLiquidityInstructionArgs, CreatePositionCpi,
    CreatePositionCpiAccounts, PermanentLockPositionCpi, PermanentLockPositionCpiAccounts,
    PermanentLockPositionInstructionArgs, SwapCpi, SwapCpiAccounts, SwapInstructionArgs,
};
use num_bigint::BigUint;
use num_traits::ToPrimitive;

declare_id!("4bRZK8XfziVhLCgvtRdFJyTgN6tXGSPJT8xfbtt1AxBB");

const VAULT_CONFIG_SEED: &[u8] = b"vault-config";
const DEPOSIT_POOL_SEED: &[u8] = b"deposit-pool";
const CLAIM_RECORD_SEED: &[u8] = b"claim-record";
const MINT_RECORD_SEED: &[u8] = b"mint-record";
const BUYBACK_VAULT_SEED: &[u8] = b"buyback-vault";
const ASTRDS_MINT: Pubkey = pubkey!("5sqKSHDKZr4KbNzj972PSfmEhtR9eLeBvv1nBRbeQAnB");
const ASTRDS_SUPPLY_CAP_RAW: u64 = 21_000_000_000_000_000; // 21M with 9 decimals
const METEORA_POSITION_NFT_MINT_SEED: &[u8] = b"meteora-position-mint";
const METEORA_POSITION_SEED: &[u8] = b"position";
const METEORA_POSITION_NFT_ACCOUNT_SEED: &[u8] = b"position_nft_account";
const METEORA_EVENT_AUTHORITY_SEED: &[u8] = b"__event_authority";
const ED25519_PROGRAM_ID: Pubkey = pubkey!("Ed25519SigVerify111111111111111111111111111");
const METEORA_PROGRAM_ID: Pubkey = pubkey!("cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG");
const METEORA_POOL_AUTHORITY: Pubkey = pubkey!("HLnpSz9h2S4hiLQ43rnSD9XkcUThA7B8hQMKmDaiTLcC");
const TOKEN_2022_PROGRAM_ID: Pubkey = pubkey!("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
const NATIVE_MINT: Pubkey = pubkey!("So11111111111111111111111111111111111111112");

#[program]
pub mod space_vault_program {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        payment_weights: PaymentWeights,
        buyback_rate: u64,
        convex_authority: Pubkey,
        operational_wallet: Pubkey,
        operator_wallet: Pubkey,
        buyback_wallet: Pubkey,
    ) -> Result<()> {
        payment_weights.validate()?;

        let config = &mut ctx.accounts.vault_config;
        config.authority = ctx.accounts.authority.key();
        config.payment_weights = payment_weights;
        config._reserved = buyback_rate;
        config.convex_authority = convex_authority;
        config.operational_wallet = operational_wallet;
        config.operator_wallet = operator_wallet;
        config.meteora_pool = buyback_wallet;
        config.bump = ctx.bumps.vault_config;

        Ok(())
    }

    pub fn set_weights(
        ctx: Context<SetWeights>,
        payment_weights: PaymentWeights,
        buyback_rate: u64,
        convex_authority: Pubkey,
    ) -> Result<()> {
        payment_weights.validate()?;

        let config = &mut ctx.accounts.vault_config;
        config.payment_weights = payment_weights;
        config._reserved = buyback_rate;
        config.convex_authority = convex_authority;

        Ok(())
    }

    pub fn set_meteora_pool(ctx: Context<SetMeteoraPool>, meteora_pool: Pubkey) -> Result<()> {
        ctx.accounts.vault_config.meteora_pool = meteora_pool;
        Ok(())
    }

    pub fn register_pool(ctx: Context<RegisterPool>) -> Result<()> {
        let pool = &mut ctx.accounts.deposit_pool;
        pool.depositor = ctx.accounts.depositor.key();
        pool.mint = ctx.accounts.mint.key();
        pool.total_deposited = 0;
        pool.remaining = 0;
        pool.active = true;
        pool.bump = ctx.bumps.deposit_pool;

        Ok(())
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        require!(amount > 0, SpaceVaultError::InvalidAmount);

        let cpi_accounts = TransferChecked {
            from: ctx.accounts.depositor_token_account.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.vault_ata.to_account_info(),
            authority: ctx.accounts.depositor.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts);
        token_interface::transfer_checked(cpi_ctx, amount, ctx.accounts.mint.decimals)?;

        let pool = &mut ctx.accounts.deposit_pool;
        pool.total_deposited = pool
            .total_deposited
            .checked_add(amount)
            .ok_or(SpaceVaultError::MathOverflow)?;
        pool.remaining = pool
            .remaining
            .checked_add(amount)
            .ok_or(SpaceVaultError::MathOverflow)?;
        pool.active = true;

        Ok(())
    }

    pub fn claim(ctx: Context<Claim>, amount: u64, claim_id: [u8; 32], expiry: i64) -> Result<()> {
        require!(amount > 0, SpaceVaultError::InvalidAmount);
        require!(
            ctx.accounts.deposit_pool.active,
            SpaceVaultError::PoolInactive
        );

        let now = Clock::get()?.unix_timestamp;
        require!(expiry >= now, SpaceVaultError::ClaimExpired);

        verify_ed25519_claim(
            &ctx.accounts.instructions_sysvar,
            ctx.accounts.vault_config.convex_authority,
            ctx.accounts.player.key(),
            ctx.accounts.deposit_pool.key(),
            amount,
            claim_id,
            expiry,
        )?;

        let (pool_depositor, pool_mint, pool_bump) = {
            let pool = &mut ctx.accounts.deposit_pool;
            require!(
                pool.remaining >= amount,
                SpaceVaultError::InsufficientPoolBalance
            );
            pool.remaining = pool
                .remaining
                .checked_sub(amount)
                .ok_or(SpaceVaultError::MathOverflow)?;
            pool.active = pool.remaining > 0;

            (pool.depositor, pool.mint, pool.bump)
        };

        let signer_seeds: &[&[u8]] = &[
            DEPOSIT_POOL_SEED,
            pool_depositor.as_ref(),
            pool_mint.as_ref(),
            &[pool_bump],
        ];
        let signer_binding = [signer_seeds];
        let cpi_accounts = TransferChecked {
            from: ctx.accounts.vault_ata.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.player_token_account.to_account_info(),
            authority: ctx.accounts.deposit_pool.to_account_info(),
        };
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts,
            &signer_binding,
        );
        token_interface::transfer_checked(cpi_ctx, amount, ctx.accounts.mint.decimals)?;

        let claim_record = &mut ctx.accounts.claim_record;
        claim_record.claim_id = claim_id;
        claim_record.claimed_at = now;
        claim_record.bump = ctx.bumps.claim_record;

        Ok(())
    }

    pub fn game_payment(ctx: Context<GamePayment>, amount: u64) -> Result<()> {
        require!(amount > 0, SpaceVaultError::InvalidAmount);

        let weights = ctx.accounts.vault_config.payment_weights;
        weights.validate()?;

        let operational_amount =
            ((amount as u128) * (weights.operational_bps as u128) / 10_000) as u64;
        let operator_amount = ((amount as u128) * (weights.operator_bps as u128) / 10_000) as u64;
        let pool_amount = amount
            .checked_sub(operational_amount)
            .and_then(|remaining| remaining.checked_sub(operator_amount))
            .ok_or(SpaceVaultError::MathOverflow)?;

        transfer_sol(
            &ctx.accounts.player.to_account_info(),
            &ctx.accounts.operational_wallet.to_account_info(),
            &ctx.accounts.system_program,
            operational_amount,
        )?;
        transfer_sol(
            &ctx.accounts.player.to_account_info(),
            &ctx.accounts.operator_wallet.to_account_info(),
            &ctx.accounts.system_program,
            operator_amount,
        )?;

        transfer_sol(
            &ctx.accounts.player.to_account_info(),
            &ctx.accounts.buyback_vault.to_account_info(),
            &ctx.accounts.system_program,
            pool_amount,
        )?;

        Ok(())
    }

    pub fn crank_liquidity(ctx: Context<CrankLiquidity>, amount: u64) -> Result<()> {
        require!(amount > 0, SpaceVaultError::InvalidAmount);

        let meteora_pool = load_meteora_pool(&ctx.accounts.meteora_pool.to_account_info())?;
        validate_meteora_accounts(&ctx, &meteora_pool)?;

        transfer_sol_from_buyback_vault(
            &ctx.accounts.buyback_vault.to_account_info(),
            &ctx.accounts.vault_config_token_b_account.to_account_info(),
            &ctx.accounts.system_program,
            amount,
            ctx.bumps.buyback_vault,
        )?;
        sync_native(
            &ctx.accounts.token_b_program.to_account_info(),
            &ctx.accounts.vault_config_token_b_account.to_account_info(),
        )?;

        if ctx.accounts.position.data_is_empty() {
            create_meteora_position(&ctx)?;
        }

        let vault_signer_seeds: &[&[u8]] = &[VAULT_CONFIG_SEED, &[ctx.accounts.vault_config.bump]];
        let vault_signer_binding = [vault_signer_seeds];

        // Meteora DAMM v2 add_liquidity is two-sided. The crank converts half of
        // the accumulated buyback SOL to token A, then adds both sides.
        let swap_amount = amount / 2;
        if swap_amount > 0 {
            SwapCpi::new(
                &ctx.accounts.meteora_program.to_account_info(),
                SwapCpiAccounts {
                    pool_authority: &ctx.accounts.pool_authority.to_account_info(),
                    pool: &ctx.accounts.meteora_pool.to_account_info(),
                    input_token_account: &ctx.accounts.vault_config_token_b_account.to_account_info(),
                    output_token_account: &ctx.accounts.vault_config_token_a_account.to_account_info(),
                    token_a_vault: &ctx.accounts.token_a_vault.to_account_info(),
                    token_b_vault: &ctx.accounts.token_b_vault.to_account_info(),
                    token_a_mint: &ctx.accounts.token_a_mint.to_account_info(),
                    token_b_mint: &ctx.accounts.token_b_mint.to_account_info(),
                    payer: &ctx.accounts.vault_config.to_account_info(),
                    token_a_program: &ctx.accounts.token_a_program.to_account_info(),
                    token_b_program: &ctx.accounts.token_b_program.to_account_info(),
                    referral_token_account: None,
                    event_authority: &ctx.accounts.event_authority.to_account_info(),
                    program: &ctx.accounts.meteora_program.to_account_info(),
                },
                SwapInstructionArgs {
                    amount_in: swap_amount,
                    minimum_amount_out: 0,
                },
            )
            .invoke_signed(&vault_signer_binding)?;
        }

        let token_a_balance = token_account_amount(&ctx.accounts.vault_config_token_a_account.to_account_info())?;
        let token_b_balance = token_account_amount(&ctx.accounts.vault_config_token_b_account.to_account_info())?;
        let liquidity_delta = liquidity_delta_from_token_balances(
            &meteora_pool,
            token_a_balance,
            token_b_balance,
        )?;

        AddLiquidityCpi::new(
            &ctx.accounts.meteora_program.to_account_info(),
            AddLiquidityCpiAccounts {
                pool: &ctx.accounts.meteora_pool.to_account_info(),
                position: &ctx.accounts.position.to_account_info(),
                token_a_account: &ctx.accounts.vault_config_token_a_account.to_account_info(),
                token_b_account: &ctx.accounts.vault_config_token_b_account.to_account_info(),
                token_a_vault: &ctx.accounts.token_a_vault.to_account_info(),
                token_b_vault: &ctx.accounts.token_b_vault.to_account_info(),
                token_a_mint: &ctx.accounts.token_a_mint.to_account_info(),
                token_b_mint: &ctx.accounts.token_b_mint.to_account_info(),
                position_nft_account: &ctx.accounts.position_nft_account.to_account_info(),
                owner: &ctx.accounts.vault_config.to_account_info(),
                token_a_program: &ctx.accounts.token_a_program.to_account_info(),
                token_b_program: &ctx.accounts.token_b_program.to_account_info(),
                event_authority: &ctx.accounts.event_authority.to_account_info(),
                program: &ctx.accounts.meteora_program.to_account_info(),
            },
            AddLiquidityInstructionArgs {
                liquidity_delta,
                token_a_amount_threshold: u64::MAX,
                token_b_amount_threshold: u64::MAX,
            },
        )
        .invoke_signed(&vault_signer_binding)?;

        PermanentLockPositionCpi::new(
            &ctx.accounts.meteora_program.to_account_info(),
            PermanentLockPositionCpiAccounts {
                pool: &ctx.accounts.meteora_pool.to_account_info(),
                position: &ctx.accounts.position.to_account_info(),
                position_nft_account: &ctx.accounts.position_nft_account.to_account_info(),
                owner: &ctx.accounts.vault_config.to_account_info(),
                event_authority: &ctx.accounts.event_authority.to_account_info(),
                program: &ctx.accounts.meteora_program.to_account_info(),
            },
            PermanentLockPositionInstructionArgs {
                permanent_lock_liquidity: liquidity_delta,
            },
        )
        .invoke_signed(&vault_signer_binding)?;

        Ok(())
    }

    pub fn mint_astrds(
        ctx: Context<MintAstrds>,
        amount: u64,
        session_id: [u8; 32],
        expiry: i64,
    ) -> Result<()> {
        require!(amount > 0, SpaceVaultError::InvalidAmount);

        let now = Clock::get()?.unix_timestamp;
        require!(expiry >= now, SpaceVaultError::ClaimExpired);

        verify_ed25519_mint(
            &ctx.accounts.instructions_sysvar,
            ctx.accounts.vault_config.convex_authority,
            ctx.accounts.player.key(),
            amount,
            session_id,
            expiry,
        )?;

        require!(
            ctx.accounts
                .astrds_mint
                .supply
                .checked_add(amount)
                .ok_or(SpaceVaultError::MathOverflow)?
                <= ASTRDS_SUPPLY_CAP_RAW,
            SpaceVaultError::SupplyCapExceeded
        );

        let vault_bump = ctx.accounts.vault_config.bump;
        let signer_seeds: &[&[u8]] = &[VAULT_CONFIG_SEED, &[vault_bump]];
        let signer_binding = [signer_seeds];

        let cpi_accounts = MintTo {
            mint: ctx.accounts.astrds_mint.to_account_info(),
            to: ctx.accounts.player_token_account.to_account_info(),
            authority: ctx.accounts.vault_config.to_account_info(),
        };
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts,
            &signer_binding,
        );
        token_interface::mint_to(cpi_ctx, amount)?;

        let mint_record = &mut ctx.accounts.mint_record;
        mint_record.session_id = session_id;
        mint_record.minted_at = now;
        mint_record.bump = ctx.bumps.mint_record;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = 8 + VaultConfig::INIT_SPACE,
        seeds = [VAULT_CONFIG_SEED],
        bump
    )]
    pub vault_config: Box<Account<'info, VaultConfig>>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetWeights<'info> {
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [VAULT_CONFIG_SEED],
        bump = vault_config.bump,
        has_one = authority
    )]
    pub vault_config: Account<'info, VaultConfig>,
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

#[derive(Accounts)]
pub struct RegisterPool<'info> {
    #[account(mut)]
    pub depositor: Signer<'info>,
    #[account(mint::token_program = token_program)]
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(
        init,
        payer = depositor,
        space = 8 + DepositPool::INIT_SPACE,
        seeds = [DEPOSIT_POOL_SEED, depositor.key().as_ref(), mint.key().as_ref()],
        bump
    )]
    pub deposit_pool: Account<'info, DepositPool>,
    #[account(
        init,
        payer = depositor,
        associated_token::mint = mint,
        associated_token::authority = deposit_pool,
        associated_token::token_program = token_program
    )]
    pub vault_ata: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub depositor: Signer<'info>,
    #[account(mint::token_program = token_program)]
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        seeds = [DEPOSIT_POOL_SEED, deposit_pool.depositor.as_ref(), deposit_pool.mint.as_ref()],
        bump = deposit_pool.bump,
        has_one = depositor,
        has_one = mint
    )]
    pub deposit_pool: Account<'info, DepositPool>,
    #[account(
        mut,
        constraint = depositor_token_account.owner == depositor.key() @ SpaceVaultError::InvalidTokenAccountOwner,
        constraint = depositor_token_account.mint == mint.key() @ SpaceVaultError::InvalidMint,
        token::token_program = token_program
    )]
    pub depositor_token_account: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = deposit_pool,
        associated_token::token_program = token_program
    )]
    pub vault_ata: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
#[instruction(amount: u64, claim_id: [u8; 32], expiry: i64)]
pub struct Claim<'info> {
    #[account(mut)]
    pub player: Signer<'info>,
    #[account(
        seeds = [VAULT_CONFIG_SEED],
        bump = vault_config.bump
    )]
    pub vault_config: Account<'info, VaultConfig>,
    #[account(mint::token_program = token_program)]
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        seeds = [DEPOSIT_POOL_SEED, deposit_pool.depositor.as_ref(), deposit_pool.mint.as_ref()],
        bump = deposit_pool.bump,
        has_one = mint
    )]
    pub deposit_pool: Account<'info, DepositPool>,
    #[account(
        init,
        payer = player,
        space = 8 + ClaimRecord::INIT_SPACE,
        seeds = [CLAIM_RECORD_SEED, claim_id.as_ref()],
        bump
    )]
    pub claim_record: Account<'info, ClaimRecord>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = deposit_pool,
        associated_token::token_program = token_program
    )]
    pub vault_ata: InterfaceAccount<'info, TokenAccount>,
    #[account(
        init_if_needed,
        payer = player,
        associated_token::mint = mint,
        associated_token::authority = player,
        associated_token::token_program = token_program
    )]
    pub player_token_account: InterfaceAccount<'info, TokenAccount>,
    /// CHECK: Validated against the instructions sysvar address in the handler.
    #[account(address = anchor_lang::solana_program::sysvar::instructions::ID)]
    pub instructions_sysvar: UncheckedAccount<'info>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct GamePayment<'info> {
    #[account(mut)]
    pub player: Signer<'info>,
    #[account(
        mut,
        seeds = [VAULT_CONFIG_SEED],
        bump = vault_config.bump
    )]
    pub vault_config: Account<'info, VaultConfig>,
    /// CHECK: Address constrained against config.
    #[account(mut, address = vault_config.operational_wallet)]
    pub operational_wallet: UncheckedAccount<'info>,
    /// CHECK: Address constrained against config.
    #[account(mut, address = vault_config.operator_wallet)]
    pub operator_wallet: UncheckedAccount<'info>,
    #[account(
        init_if_needed,
        payer = player,
        space = 0,
        seeds = [BUYBACK_VAULT_SEED],
        bump,
        owner = system_program.key()
    )]
    /// CHECK: PDA system account initialized with zero data; only receives the buyback SOL slice.
    pub buyback_vault: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(amount: u64, session_id: [u8; 32], expiry: i64)]
pub struct MintAstrds<'info> {
    #[account(mut)]
    pub player: Signer<'info>,
    #[account(
        seeds = [VAULT_CONFIG_SEED],
        bump = vault_config.bump
    )]
    pub vault_config: Account<'info, VaultConfig>,
    #[account(
        mut,
        constraint = astrds_mint.key() == ASTRDS_MINT @ SpaceVaultError::InvalidAstrdsMint,
        mint::token_program = token_program
    )]
    pub astrds_mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(
        init_if_needed,
        payer = player,
        associated_token::mint = astrds_mint,
        associated_token::authority = player,
        associated_token::token_program = token_program
    )]
    pub player_token_account: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(
        init,
        payer = player,
        space = 8 + MintRecord::INIT_SPACE,
        seeds = [MINT_RECORD_SEED, session_id.as_ref()],
        bump
    )]
    pub mint_record: Account<'info, MintRecord>,
    /// CHECK: Validated against the instructions sysvar address in the handler.
    #[account(address = anchor_lang::solana_program::sysvar::instructions::ID)]
    pub instructions_sysvar: UncheckedAccount<'info>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CrankLiquidity<'info> {
    #[account(mut)]
    pub cranker: Signer<'info>,
    #[account(
        mut,
        seeds = [VAULT_CONFIG_SEED],
        bump = vault_config.bump
    )]
    pub vault_config: Account<'info, VaultConfig>,
    #[account(
        mut,
        seeds = [BUYBACK_VAULT_SEED],
        bump
    )]
    pub buyback_vault: SystemAccount<'info>,
    /// CHECK: Address constrained against config.
    #[account(mut, address = vault_config.meteora_pool)]
    pub meteora_pool: UncheckedAccount<'info>,
    /// CHECK: Deterministic position NFT mint PDA controlled by this program.
    #[account(
        mut,
        seeds = [METEORA_POSITION_NFT_MINT_SEED],
        bump
    )]
    pub position_nft_mint: UncheckedAccount<'info>,
    /// CHECK: Meteora position PDA derived from the deterministic NFT mint.
    #[account(
        mut,
        seeds = [METEORA_POSITION_SEED, position_nft_mint.key().as_ref()],
        bump,
        seeds::program = meteora_program.key()
    )]
    pub position: UncheckedAccount<'info>,
    /// CHECK: Meteora position NFT token account PDA.
    #[account(
        mut,
        seeds = [METEORA_POSITION_NFT_ACCOUNT_SEED, position_nft_mint.key().as_ref()],
        bump,
        seeds::program = meteora_program.key()
    )]
    pub position_nft_account: UncheckedAccount<'info>,
    #[account(mint::token_program = token_a_program)]
    pub token_a_mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(mint::token_program = token_b_program)]
    pub token_b_mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(
        init_if_needed,
        payer = cranker,
        associated_token::mint = token_a_mint,
        associated_token::authority = vault_config,
        associated_token::token_program = token_a_program
    )]
    pub vault_config_token_a_account: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(
        init_if_needed,
        payer = cranker,
        associated_token::mint = token_b_mint,
        associated_token::authority = vault_config,
        associated_token::token_program = token_b_program
    )]
    pub vault_config_token_b_account: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(
        mut,
        token::mint = token_a_mint,
        token::token_program = token_a_program
    )]
    pub token_a_vault: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(
        mut,
        token::mint = token_b_mint,
        token::token_program = token_b_program
    )]
    pub token_b_vault: Box<InterfaceAccount<'info, TokenAccount>>,
    /// CHECK: Fixed Meteora pool authority account.
    #[account(address = METEORA_POOL_AUTHORITY)]
    pub pool_authority: UncheckedAccount<'info>,
    /// CHECK: Derived Meteora event authority PDA.
    #[account(
        seeds = [METEORA_EVENT_AUTHORITY_SEED],
        bump,
        seeds::program = meteora_program.key()
    )]
    pub event_authority: UncheckedAccount<'info>,
    /// CHECK: Meteora DAMM v2 program.
    #[account(address = METEORA_PROGRAM_ID)]
    pub meteora_program: UncheckedAccount<'info>,
    /// CHECK: Token-2022 program used for the Meteora position NFT mint.
    #[account(address = TOKEN_2022_PROGRAM_ID)]
    pub position_token_program: UncheckedAccount<'info>,
    pub token_a_program: Interface<'info, TokenInterface>,
    pub token_b_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[account]
#[derive(InitSpace)]
pub struct VaultConfig {
    pub authority: Pubkey,
    pub payment_weights: PaymentWeights,
    pub _reserved: u64,
    pub convex_authority: Pubkey,
    pub operational_wallet: Pubkey,
    pub operator_wallet: Pubkey,
    pub meteora_pool: Pubkey,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct DepositPool {
    pub depositor: Pubkey,
    pub mint: Pubkey,
    pub total_deposited: u64,
    pub remaining: u64,
    pub active: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct ClaimRecord {
    pub claim_id: [u8; 32],
    pub claimed_at: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct MintRecord {
    pub session_id: [u8; 32],
    pub minted_at: i64,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq, InitSpace)]
pub struct PaymentWeights {
    pub operational_bps: u16,
    pub operator_bps: u16,
    pub buyback_bps: u16,
}

impl PaymentWeights {
    fn validate(&self) -> Result<()> {
        let total =
            self.operational_bps as u32 + self.operator_bps as u32 + self.buyback_bps as u32;
        require!(total == 10_000, SpaceVaultError::InvalidWeights);
        Ok(())
    }
}

fn transfer_sol<'info>(
    from: &AccountInfo<'info>,
    to: &AccountInfo<'info>,
    system_program: &Program<'info, System>,
    amount: u64,
) -> Result<()> {
    if amount == 0 {
        return Ok(());
    }

    let cpi_ctx = CpiContext::new(
        system_program.to_account_info(),
        SolTransfer {
            from: from.clone(),
            to: to.clone(),
        },
    );
    system_program::transfer(cpi_ctx, amount)
}

fn transfer_sol_from_buyback_vault<'info>(
    from: &AccountInfo<'info>,
    to: &AccountInfo<'info>,
    system_program: &Program<'info, System>,
    amount: u64,
    bump: u8,
) -> Result<()> {
    if amount == 0 {
        return Ok(());
    }

    require!(
        from.lamports() >= amount,
        SpaceVaultError::InsufficientBuybackBalance
    );

    let signer_seeds: &[&[u8]] = &[BUYBACK_VAULT_SEED, &[bump]];
    let signer_binding = [signer_seeds];
    let cpi_ctx = CpiContext::new_with_signer(
        system_program.to_account_info(),
        SolTransfer {
            from: from.clone(),
            to: to.clone(),
        },
        &signer_binding,
    );
    system_program::transfer(cpi_ctx, amount)
}

fn sync_native(token_program: &AccountInfo<'_>, token_account: &AccountInfo<'_>) -> Result<()> {
    let ix = token::spl_token::instruction::sync_native(token_program.key, token_account.key)?;
    invoke(&ix, &[token_account.clone()])?;
    Ok(())
}

fn load_meteora_pool(account: &AccountInfo<'_>) -> Result<MeteoraPool> {
    require_keys_eq!(
        *account.owner,
        METEORA_PROGRAM_ID,
        SpaceVaultError::InvalidMeteoraProgram
    );
    MeteoraPool::try_from(account).map_err(|_| error!(SpaceVaultError::InvalidMeteoraPool))
}

fn validate_meteora_accounts(ctx: &Context<CrankLiquidity>, pool: &MeteoraPool) -> Result<()> {
    require_keys_eq!(
        Pubkey::new_from_array(pool.token_a_mint.to_bytes()),
        ctx.accounts.token_a_mint.key(),
        SpaceVaultError::InvalidMeteoraMint
    );
    require_keys_eq!(
        Pubkey::new_from_array(pool.token_b_mint.to_bytes()),
        ctx.accounts.token_b_mint.key(),
        SpaceVaultError::InvalidMeteoraMint
    );
    require_keys_eq!(
        Pubkey::new_from_array(pool.token_a_vault.to_bytes()),
        ctx.accounts.token_a_vault.key(),
        SpaceVaultError::InvalidMeteoraVault
    );
    require_keys_eq!(
        Pubkey::new_from_array(pool.token_b_vault.to_bytes()),
        ctx.accounts.token_b_vault.key(),
        SpaceVaultError::InvalidMeteoraVault
    );
    require_keys_eq!(
        ctx.accounts.token_b_mint.key(),
        NATIVE_MINT,
        SpaceVaultError::InvalidWrappedSolMint
    );
    require_keys_eq!(
        ctx.accounts.pool_authority.key(),
        METEORA_POOL_AUTHORITY,
        SpaceVaultError::InvalidMeteoraPoolAuthority
    );
    Ok(())
}

fn create_meteora_position(ctx: &Context<CrankLiquidity>) -> Result<()> {
    let position_mint_seeds: &[&[u8]] = &[
        METEORA_POSITION_NFT_MINT_SEED,
        &[ctx.bumps.position_nft_mint],
    ];
    let position_mint_binding = [position_mint_seeds];

    CreatePositionCpi::new(
        &ctx.accounts.meteora_program.to_account_info(),
        CreatePositionCpiAccounts {
            owner: &ctx.accounts.vault_config.to_account_info(),
            position_nft_mint: &ctx.accounts.position_nft_mint.to_account_info(),
            position_nft_account: &ctx.accounts.position_nft_account.to_account_info(),
            pool: &ctx.accounts.meteora_pool.to_account_info(),
            position: &ctx.accounts.position.to_account_info(),
            pool_authority: &ctx.accounts.pool_authority.to_account_info(),
            payer: &ctx.accounts.cranker.to_account_info(),
            token_program: &ctx.accounts.position_token_program.to_account_info(),
            system_program: &ctx.accounts.system_program.to_account_info(),
            event_authority: &ctx.accounts.event_authority.to_account_info(),
            program: &ctx.accounts.meteora_program.to_account_info(),
        },
    )
    .invoke_signed(&position_mint_binding)?;

    Ok(())
}

fn token_account_amount(account: &AccountInfo<'_>) -> Result<u64> {
    let data = account.try_borrow_data()?;
    let mut data_slice: &[u8] = &data;
    let token_account = TokenAccount::try_deserialize_unchecked(&mut data_slice)?;
    Ok(token_account.amount)
}

fn liquidity_delta_from_token_balances(
    pool: &MeteoraPool,
    token_a_amount: u64,
    token_b_amount: u64,
) -> Result<u128> {
    let liquidity_from_a = liquidity_delta_from_token_a(pool, token_a_amount)?;
    let liquidity_from_b = liquidity_delta_from_token_b(pool, token_b_amount)?;
    let liquidity_delta = liquidity_from_a.min(liquidity_from_b);

    // Bias down by one liquidity unit to avoid transfer rounding asking for one
    // atom more than the post-swap vault accounts actually hold.
    let liquidity_delta = liquidity_delta
        .checked_sub(1)
        .ok_or(error!(SpaceVaultError::InvalidLiquidityQuote))?;
    require!(liquidity_delta > 0, SpaceVaultError::InvalidLiquidityQuote);

    Ok(liquidity_delta)
}

fn liquidity_delta_from_token_a(pool: &MeteoraPool, token_a_amount: u64) -> Result<u128> {
    let delta = pool
        .sqrt_max_price
        .checked_sub(pool.sqrt_price)
        .ok_or(error!(SpaceVaultError::InvalidLiquidityQuote))?;
    require!(delta > 0, SpaceVaultError::InvalidLiquidityQuote);

    let numerator = BigUint::from(token_a_amount)
        * BigUint::from(pool.sqrt_price)
        * BigUint::from(pool.sqrt_max_price);
    let denominator = BigUint::from(delta);
    let liquidity_delta = (numerator / denominator)
        .to_u128()
        .ok_or(error!(SpaceVaultError::MathOverflow))?;
    require!(liquidity_delta > 0, SpaceVaultError::InvalidLiquidityQuote);

    Ok(liquidity_delta)
}

fn liquidity_delta_from_token_b(pool: &MeteoraPool, token_b_amount: u64) -> Result<u128> {
    let delta = pool
        .sqrt_price
        .checked_sub(pool.sqrt_min_price)
        .ok_or(error!(SpaceVaultError::InvalidLiquidityQuote))?;
    require!(delta > 0, SpaceVaultError::InvalidLiquidityQuote);

    let numerator = BigUint::from(token_b_amount) << 64usize;
    let denominator = BigUint::from(delta);
    let liquidity_delta = (numerator / denominator)
        .to_u128()
        .ok_or(error!(SpaceVaultError::MathOverflow))?;
    require!(liquidity_delta > 0, SpaceVaultError::InvalidLiquidityQuote);

    Ok(liquidity_delta)
}

fn verify_ed25519_claim(
    instructions_sysvar: &UncheckedAccount<'_>,
    convex_authority: Pubkey,
    player: Pubkey,
    pool_id: Pubkey,
    amount: u64,
    claim_id: [u8; 32],
    expiry: i64,
) -> Result<()> {
    let current_ix_index =
        load_current_index_checked(&instructions_sysvar.to_account_info())? as usize;
    require!(
        current_ix_index > 0,
        SpaceVaultError::MissingEd25519Instruction
    );

    let ix =
        load_instruction_at_checked(current_ix_index - 1, &instructions_sysvar.to_account_info())?;
    require_keys_eq!(
        ix.program_id,
        ED25519_PROGRAM_ID,
        SpaceVaultError::InvalidEd25519Instruction
    );

    let expected_message = build_claim_message(player, pool_id, amount, claim_id, expiry);
    validate_ed25519_instruction(&ix, convex_authority, &expected_message)
}

fn build_claim_message(
    player: Pubkey,
    pool_id: Pubkey,
    amount: u64,
    claim_id: [u8; 32],
    expiry: i64,
) -> Vec<u8> {
    let mut message = Vec::with_capacity(112);
    message.extend_from_slice(player.as_ref());
    message.extend_from_slice(pool_id.as_ref());
    message.extend_from_slice(&amount.to_le_bytes());
    message.extend_from_slice(&claim_id);
    message.extend_from_slice(&expiry.to_le_bytes());
    message
}

fn validate_ed25519_instruction(
    ix: &Instruction,
    convex_authority: Pubkey,
    expected_message: &[u8],
) -> Result<()> {
    require!(
        ix.accounts.is_empty(),
        SpaceVaultError::InvalidEd25519Instruction
    );

    let data = ix.data.as_slice();
    let expected_len = 16 + 32 + 64 + expected_message.len();
    require!(
        data.len() == expected_len,
        SpaceVaultError::InvalidEd25519Instruction
    );
    require!(
        data[0] == 1 && data[1] == 0,
        SpaceVaultError::InvalidEd25519Instruction
    );

    let signature_offset = read_u16(data, 2)? as usize;
    let signature_instruction_index = read_u16(data, 4)?;
    let public_key_offset = read_u16(data, 6)? as usize;
    let public_key_instruction_index = read_u16(data, 8)?;
    let message_data_offset = read_u16(data, 10)? as usize;
    let message_data_size = read_u16(data, 12)? as usize;
    let message_instruction_index = read_u16(data, 14)?;

    require!(
        signature_offset == 48,
        SpaceVaultError::InvalidEd25519Instruction
    );
    require!(
        public_key_offset == 16,
        SpaceVaultError::InvalidEd25519Instruction
    );
    require!(
        message_data_offset == 112 && message_data_size == expected_message.len(),
        SpaceVaultError::InvalidEd25519Instruction
    );
    require!(
        signature_instruction_index == u16::MAX
            && public_key_instruction_index == u16::MAX
            && message_instruction_index == u16::MAX,
        SpaceVaultError::InvalidEd25519Instruction
    );
    require!(
        data[public_key_offset..public_key_offset + 32] == convex_authority.to_bytes(),
        SpaceVaultError::InvalidConvexAuthority
    );
    require!(
        &data[message_data_offset..message_data_offset + message_data_size] == expected_message,
        SpaceVaultError::InvalidClaimMessage
    );

    Ok(())
}

fn read_u16(data: &[u8], offset: usize) -> Result<u16> {
    let bytes = data
        .get(offset..offset + 2)
        .ok_or(error!(SpaceVaultError::InvalidEd25519Instruction))?;
    Ok(u16::from_le_bytes([bytes[0], bytes[1]]))
}

fn build_mint_message(player: Pubkey, amount: u64, session_id: [u8; 32], expiry: i64) -> Vec<u8> {
    let mut message = Vec::with_capacity(80);
    message.extend_from_slice(player.as_ref());
    message.extend_from_slice(&amount.to_le_bytes());
    message.extend_from_slice(&session_id);
    message.extend_from_slice(&expiry.to_le_bytes());
    message
}

fn verify_ed25519_mint(
    instructions_sysvar: &UncheckedAccount<'_>,
    convex_authority: Pubkey,
    player: Pubkey,
    amount: u64,
    session_id: [u8; 32],
    expiry: i64,
) -> Result<()> {
    let current_ix_index =
        load_current_index_checked(&instructions_sysvar.to_account_info())? as usize;
    require!(
        current_ix_index > 0,
        SpaceVaultError::MissingEd25519Instruction
    );

    let ix =
        load_instruction_at_checked(current_ix_index - 1, &instructions_sysvar.to_account_info())?;
    require_keys_eq!(
        ix.program_id,
        ED25519_PROGRAM_ID,
        SpaceVaultError::InvalidEd25519Instruction
    );

    let expected_message = build_mint_message(player, amount, session_id, expiry);
    validate_ed25519_instruction(&ix, convex_authority, &expected_message)
}

#[error_code]
pub enum SpaceVaultError {
    #[msg("Payment weights must sum to 10000 basis points.")]
    InvalidWeights,
    #[msg("Amount must be greater than zero.")]
    InvalidAmount,
    #[msg("Arithmetic overflow.")]
    MathOverflow,
    #[msg("Deposit pool is inactive.")]
    PoolInactive,
    #[msg("Claim has expired.")]
    ClaimExpired,
    #[msg("Missing ed25519 verification instruction.")]
    MissingEd25519Instruction,
    #[msg("Invalid ed25519 verification instruction.")]
    InvalidEd25519Instruction,
    #[msg("Invalid Convex authority.")]
    InvalidConvexAuthority,
    #[msg("Claim message does not match the signed payload.")]
    InvalidClaimMessage,
    #[msg("Pool balance is insufficient for this claim.")]
    InsufficientPoolBalance,
    #[msg("Token account owner does not match the expected signer.")]
    InvalidTokenAccountOwner,
    #[msg("Token mint does not match the pool mint.")]
    InvalidMint,
    #[msg("Invalid Meteora DAMM v2 program account.")]
    InvalidMeteoraProgram,
    #[msg("Failed to deserialize the configured Meteora pool.")]
    InvalidMeteoraPool,
    #[msg("Meteora mint accounts do not match the configured pool.")]
    InvalidMeteoraMint,
    #[msg("Meteora vault accounts do not match the configured pool.")]
    InvalidMeteoraVault,
    #[msg("Configured Meteora pool authority is invalid.")]
    InvalidMeteoraPoolAuthority,
    #[msg("Configured Meteora pool must use wrapped SOL as token B.")]
    InvalidWrappedSolMint,
    #[msg("Insufficient accumulated buyback SOL in the vault config PDA.")]
    InsufficientBuybackBalance,
    #[msg("Unable to derive a valid Meteora liquidity quote from the pool state.")]
    InvalidLiquidityQuote,
    #[msg("Mint address does not match the configured ASTRDS token.")]
    InvalidAstrdsMint,
    #[msg("ASTRDS supply cap exceeded.")]
    SupplyCapExceeded,
}
