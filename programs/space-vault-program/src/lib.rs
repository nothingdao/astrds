use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    instruction::Instruction,
    sysvar::instructions::{load_current_index_checked, load_instruction_at_checked},
};
use anchor_lang::system_program::{self, Transfer as SolTransfer};
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked};

declare_id!("3TXqXvJfVsD2S9k2kuE5wCt4JqnMuU3UB1RStKTTF7kE");

const VAULT_CONFIG_SEED: &[u8] = b"vault-config";
const DEPOSIT_POOL_SEED: &[u8] = b"deposit-pool";
const CLAIM_RECORD_SEED: &[u8] = b"claim-record";
const ED25519_PROGRAM_ID: Pubkey = pubkey!("Ed25519SigVerify111111111111111111111111111");

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
        config.buyback_rate = buyback_rate;
        config.convex_authority = convex_authority;
        config.operational_wallet = operational_wallet;
        config.operator_wallet = operator_wallet;
        config.buyback_wallet = buyback_wallet;
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
        config.buyback_rate = buyback_rate;
        config.convex_authority = convex_authority;

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
        let buyback_amount = amount
            .checked_sub(operational_amount)
            .and_then(|remaining| remaining.checked_sub(operator_amount))
            .ok_or(SpaceVaultError::MathOverflow)?;

        transfer_sol(
            &ctx.accounts.player,
            &ctx.accounts.operational_wallet,
            &ctx.accounts.system_program,
            operational_amount,
        )?;
        transfer_sol(
            &ctx.accounts.player,
            &ctx.accounts.operator_wallet,
            &ctx.accounts.system_program,
            operator_amount,
        )?;
        transfer_sol(
            &ctx.accounts.player,
            &ctx.accounts.buyback_wallet,
            &ctx.accounts.system_program,
            buyback_amount,
        )?;

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
    pub vault_config: Account<'info, VaultConfig>,
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
    /// CHECK: Address constrained against config.
    #[account(mut, address = vault_config.buyback_wallet)]
    pub buyback_wallet: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
#[derive(InitSpace)]
pub struct VaultConfig {
    pub authority: Pubkey,
    pub payment_weights: PaymentWeights,
    pub buyback_rate: u64,
    pub convex_authority: Pubkey,
    pub operational_wallet: Pubkey,
    pub operator_wallet: Pubkey,
    pub buyback_wallet: Pubkey,
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
    from: &Signer<'info>,
    to: &UncheckedAccount<'info>,
    system_program: &Program<'info, System>,
    amount: u64,
) -> Result<()> {
    if amount == 0 {
        return Ok(());
    }

    let cpi_ctx = CpiContext::new(
        system_program.to_account_info(),
        SolTransfer {
            from: from.to_account_info(),
            to: to.to_account_info(),
        },
    );
    system_program::transfer(cpi_ctx, amount)
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
}
