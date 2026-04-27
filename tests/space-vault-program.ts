import * as anchor from "@coral-xyz/anchor";
import { Program, web3, BN } from "@coral-xyz/anchor";
import { expect } from "chai";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createMint,
  getAccount,
  getAssociatedTokenAddressSync,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

const { Keypair, PublicKey, SystemProgram, Ed25519Program, LAMPORTS_PER_SOL } =
  web3;

const METEORA_POOL = new PublicKey("EQPzzbREwvEkZeJ7bvcasrz3tAsADtGAJxzTtcxiTCQG");
const METEORA_PROGRAM_ID = new PublicKey("cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG");
const METEORA_POOL_AUTHORITY = new PublicKey("HLnpSz9h2S4hiLQ43rnSD9XkcUThA7B8hQMKmDaiTLcC");
const METEORA_POSITION_TOKEN_PROGRAM_ID = TOKEN_2022_PROGRAM_ID;
const POOL_ACCOUNT_DISCRIMINATOR_SIZE = 8;
const POOL_FEES_STRUCT_SIZE = 160;
const PUBLIC_KEY_SIZE = 32;
const TOKEN_A_MINT_OFFSET = POOL_ACCOUNT_DISCRIMINATOR_SIZE + POOL_FEES_STRUCT_SIZE;
const TOKEN_B_MINT_OFFSET = TOKEN_A_MINT_OFFSET + PUBLIC_KEY_SIZE;
const TOKEN_A_VAULT_OFFSET = TOKEN_B_MINT_OFFSET + PUBLIC_KEY_SIZE;
const TOKEN_B_VAULT_OFFSET = TOKEN_A_VAULT_OFFSET + PUBLIC_KEY_SIZE;

const CONVEX_AUTHORITY_SECRET = Uint8Array.from([
  27, 239, 24, 21, 22, 250, 9, 63, 110, 138, 142, 235, 13, 196, 170, 240, 164,
  29, 232, 72, 246, 10, 191, 72, 9, 84, 1, 165, 248, 116, 241, 185, 58, 93, 104,
  201, 79, 16, 163, 209, 105, 144, 58, 63, 144, 87, 169, 148, 148, 180, 232,
  245, 1, 107, 116, 213, 73, 8, 33, 37, 199, 135, 125, 233,
]);

describe("space-vault-program", () => {
  anchor.setProvider(anchor.AnchorProvider.env());

  const provider = anchor.getProvider() as anchor.AnchorProvider;
  const program = anchor.workspace.spaceVaultProgram as Program;
  const accounts = program.account as any;
  const authority = provider.wallet as anchor.Wallet & { payer: web3.Keypair };
  const convexAuthority = Keypair.fromSecretKey(CONVEX_AUTHORITY_SECRET);
  const replacementConvexAuthority = Keypair.generate();

  const weights = {
    operationalBps: 5_000,
    operatorBps: 3_000,
    buybackBps: 2_000,
  };

  const updatedWeights = {
    operationalBps: 4_000,
    operatorBps: 2_500,
    buybackBps: 3_500,
  };

  const [vaultConfigPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault-config")],
    program.programId
  );

  const operationalWallet = Keypair.generate();
  const operatorWallet = Keypair.generate();
  const depositor = Keypair.generate();
  const player = Keypair.generate();
  const outsider = Keypair.generate();

  let mint: web3.PublicKey;
  let depositorAta: web3.PublicKey;
  let playerAta: web3.PublicKey;
  let depositPoolPda: web3.PublicKey;
  let vaultAta: web3.PublicKey;
  let token2022Mint: web3.PublicKey;
  let token2022DepositorAta: web3.PublicKey;
  let token2022PlayerAta: web3.PublicKey;
  let token2022DepositPoolPda: web3.PublicKey;
  let token2022VaultAta: web3.PublicKey;

  const claimId = Array.from(Buffer.alloc(32, 7));

  const readPublicKey = (data: Buffer, offset: number) =>
    new PublicKey(data.subarray(offset, offset + PUBLIC_KEY_SIZE));

  const loadTokenProgramForMint = async (mintAddress: any) => {
    const mintAccount = await provider.connection.getAccountInfo(mintAddress);
    if (!mintAccount) {
      throw new Error(`Missing mint account: ${mintAddress.toBase58()}`);
    }

    return mintAccount.owner.equals(TOKEN_2022_PROGRAM_ID)
      ? TOKEN_2022_PROGRAM_ID
      : TOKEN_PROGRAM_ID;
  };

  const deriveMeteoraGamePaymentAccounts = async () => {
    const poolAccount = await provider.connection.getAccountInfo(METEORA_POOL);
    if (!poolAccount) {
      return null;
    }

    const poolData = Buffer.from(poolAccount.data);
    const tokenAMint = readPublicKey(poolData, TOKEN_A_MINT_OFFSET);
    const tokenBMint = readPublicKey(poolData, TOKEN_B_MINT_OFFSET);
    const tokenAVault = readPublicKey(poolData, TOKEN_A_VAULT_OFFSET);
    const tokenBVault = readPublicKey(poolData, TOKEN_B_VAULT_OFFSET);
    const [tokenAProgram, tokenBProgram] = await Promise.all([
      loadTokenProgramForMint(tokenAMint),
      loadTokenProgramForMint(tokenBMint),
    ]);
    const [positionNftMint] = PublicKey.findProgramAddressSync(
      [Buffer.from("meteora-position-mint")],
      program.programId
    );
    const [position] = PublicKey.findProgramAddressSync(
      [Buffer.from("position"), positionNftMint.toBuffer()],
      METEORA_PROGRAM_ID
    );
    const [positionNftAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from("position_nft_account"), positionNftMint.toBuffer()],
      METEORA_PROGRAM_ID
    );
    const [eventAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from("__event_authority")],
      METEORA_PROGRAM_ID
    );
    const vaultConfigTokenAAccount = getAssociatedTokenAddressSync(
      tokenAMint,
      vaultConfigPda,
      true,
      tokenAProgram,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    const vaultConfigTokenBAccount = getAssociatedTokenAddressSync(
      tokenBMint,
      vaultConfigPda,
      true,
      tokenBProgram,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    return {
      meteoraPool: METEORA_POOL,
      positionNftMint,
      position,
      positionNftAccount,
      tokenAMint,
      tokenBMint,
      vaultConfigTokenAAccount,
      vaultConfigTokenBAccount,
      tokenAVault,
      tokenBVault,
      poolAuthority: METEORA_POOL_AUTHORITY,
      eventAuthority,
      meteoraProgram: METEORA_PROGRAM_ID,
      positionTokenProgram: METEORA_POSITION_TOKEN_PROGRAM_ID,
      tokenAProgram,
      tokenBProgram,
    };
  };

  const expectFailure = async (
    promise: Promise<unknown>,
    expectedMessage?: string
  ) => {
    try {
      await promise;
      expect.fail("expected transaction to fail");
    } catch (error) {
      const message = `${error}`;
      if (expectedMessage) {
        expect(message).to.include(expectedMessage);
      }
    }
  };

  before(async () => {
    await Promise.all(
      [
        operationalWallet,
        operatorWallet,
        depositor,
        player,
        outsider,
      ].map(async (kp) => {
        const sig = await provider.connection.requestAirdrop(
          kp.publicKey,
          2 * LAMPORTS_PER_SOL
        );
        await provider.connection.confirmTransaction(sig, "confirmed");
      })
    );

    mint = await createMint(
      provider.connection,
      authority.payer,
      authority.publicKey,
      null,
      6,
      undefined,
      undefined,
      TOKEN_PROGRAM_ID
    );

    depositorAta = (
      await getOrCreateAssociatedTokenAccount(
        provider.connection,
        authority.payer,
        mint,
        depositor.publicKey
      )
    ).address;
    playerAta = getAssociatedTokenAddressSync(mint, player.publicKey);

    await mintTo(
      provider.connection,
      authority.payer,
      mint,
      depositorAta,
      authority.publicKey,
      BigInt("1000000000")
    );

    [depositPoolPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("deposit-pool"),
        depositor.publicKey.toBuffer(),
        mint.toBuffer(),
      ],
      program.programId
    );
    vaultAta = getAssociatedTokenAddressSync(
      mint,
      depositPoolPda,
      true,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    token2022Mint = await createMint(
      provider.connection,
      authority.payer,
      authority.publicKey,
      null,
      6,
      undefined,
      undefined,
      TOKEN_2022_PROGRAM_ID
    );

    token2022DepositorAta = (
      await getOrCreateAssociatedTokenAccount(
        provider.connection,
        authority.payer,
        token2022Mint,
        depositor.publicKey,
        true,
        "confirmed",
        undefined,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    ).address;
    token2022PlayerAta = getAssociatedTokenAddressSync(
      token2022Mint,
      player.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    await mintTo(
      provider.connection,
      authority.payer,
      token2022Mint,
      token2022DepositorAta,
      authority.publicKey,
      BigInt("300000000"),
      [],
      undefined,
      TOKEN_2022_PROGRAM_ID
    );

    [token2022DepositPoolPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("deposit-pool"),
        depositor.publicKey.toBuffer(),
        token2022Mint.toBuffer(),
      ],
      program.programId
    );
    token2022VaultAta = getAssociatedTokenAddressSync(
      token2022Mint,
      token2022DepositPoolPda,
      true,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
  });

  it("initializes the singleton config", async () => {
    await program.methods
      .initialize(
        weights,
        new BN(25),
        convexAuthority.publicKey,
        operationalWallet.publicKey,
        operatorWallet.publicKey,
        METEORA_POOL
      )
      .accounts({
        authority: authority.publicKey,
        vaultConfig: vaultConfigPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const config = await accounts.vaultConfig.fetch(vaultConfigPda);
    expect(config.authority.toBase58()).to.eq(authority.publicKey.toBase58());
    expect((config._reserved ?? config.reserved).toNumber()).to.eq(25);
    expect(config.convexAuthority.toBase58()).to.eq(
      convexAuthority.publicKey.toBase58()
    );
    expect(config.meteoraPool.toBase58()).to.eq(METEORA_POOL.toBase58());
    expect(config.paymentWeights.operationalBps).to.eq(weights.operationalBps);
    expect(config.paymentWeights.operatorBps).to.eq(weights.operatorBps);
    expect(config.paymentWeights.buybackBps).to.eq(weights.buybackBps);
  });

  it("rejects unauthorized weight updates and accepts authority updates", async () => {
    await expectFailure(
      program.methods
        .setWeights(
          updatedWeights,
          new BN(50),
          replacementConvexAuthority.publicKey
        )
        .accounts({
          authority: outsider.publicKey,
          vaultConfig: vaultConfigPda,
        })
        .signers([outsider])
        .rpc()
    );

    await program.methods
      .setWeights(
        updatedWeights,
        new BN(50),
        replacementConvexAuthority.publicKey
      )
      .accounts({
        authority: authority.publicKey,
        vaultConfig: vaultConfigPda,
      })
      .rpc();

    const config = await accounts.vaultConfig.fetch(vaultConfigPda);
    expect((config._reserved ?? config.reserved).toNumber()).to.eq(50);
    expect(config.convexAuthority.toBase58()).to.eq(
      replacementConvexAuthority.publicKey.toBase58()
    );
    expect(config.paymentWeights.operationalBps).to.eq(
      updatedWeights.operationalBps
    );
    expect(config.paymentWeights.operatorBps).to.eq(updatedWeights.operatorBps);
    expect(config.paymentWeights.buybackBps).to.eq(updatedWeights.buybackBps);
  });

  it("registers a deposit pool and vault ATA", async () => {
    await program.methods
      .registerPool()
      .accounts({
        depositor: depositor.publicKey,
        mint,
        depositPool: depositPoolPda,
        vaultAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([depositor])
      .rpc();

    const pool = await accounts.depositPool.fetch(depositPoolPda);
    expect(pool.depositor.toBase58()).to.eq(depositor.publicKey.toBase58());
    expect(pool.mint.toBase58()).to.eq(mint.toBase58());
    expect(pool.active).to.eq(true);

    const vaultAccount = await getAccount(provider.connection, vaultAta);
    expect(vaultAccount.owner.toBase58()).to.eq(depositPoolPda.toBase58());
  });

  it("deposits SPL tokens into the vault ATA", async () => {
    const amount = new BN(500_000_000);

    await program.methods
      .deposit(amount)
      .accounts({
        depositor: depositor.publicKey,
        mint,
        depositPool: depositPoolPda,
        depositorTokenAccount: depositorAta,
        vaultAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([depositor])
      .rpc();

    const pool = await accounts.depositPool.fetch(depositPoolPda);
    const vaultAccount = await getAccount(provider.connection, vaultAta);

    expect(pool.totalDeposited.toString()).to.eq(amount.toString());
    expect(pool.remaining.toString()).to.eq(amount.toString());
    expect(vaultAccount.amount).to.eq(BigInt(amount.toString()));
  });

  it("claims tokens with ed25519 authorization and prevents replay", async () => {
    const amount = new BN(125_000_000);
    const expiry = new BN(Math.floor(Date.now() / 1000) + 60);
    const claimIdBuffer = Buffer.from(claimId);
    const [claimRecordPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("claim-record"), claimIdBuffer],
      program.programId
    );

    const message = Buffer.concat([
      player.publicKey.toBuffer(),
      depositPoolPda.toBuffer(),
      amount.toArrayLike(Buffer, "le", 8),
      claimIdBuffer,
      expiry.toArrayLike(Buffer, "le", 8),
    ]);

    const ed25519Ix = Ed25519Program.createInstructionWithPrivateKey({
      privateKey: replacementConvexAuthority.secretKey,
      message,
    });

    await program.methods
      .claim(amount, claimId, expiry)
      .accounts({
        player: player.publicKey,
        vaultConfig: vaultConfigPda,
        mint,
        depositPool: depositPoolPda,
        claimRecord: claimRecordPda,
        vaultAta,
        playerTokenAccount: playerAta,
        instructionsSysvar: web3.SYSVAR_INSTRUCTIONS_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        })
        .preInstructions([ed25519Ix])
        .signers([player])
        .rpc();

    const playerAccount = await getAccount(provider.connection, playerAta);
    const pool = await accounts.depositPool.fetch(depositPoolPda);
    const claimRecord = await accounts.claimRecord.fetch(claimRecordPda);

    expect(playerAccount.amount).to.eq(BigInt(amount.toString()));
    expect(pool.remaining.toString()).to.eq(new BN(375_000_000).toString());
    expect(Buffer.from(claimRecord.claimId)).to.deep.eq(claimIdBuffer);

    await expectFailure(
      program.methods
        .claim(amount, claimId, expiry)
        .accounts({
          player: player.publicKey,
          vaultConfig: vaultConfigPda,
          mint,
          depositPool: depositPoolPda,
          claimRecord: claimRecordPda,
          vaultAta,
          playerTokenAccount: playerAta,
          instructionsSysvar: web3.SYSVAR_INSTRUCTIONS_PUBKEY,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .preInstructions([ed25519Ix])
        .signers([player])
        .rpc()
    );
  });

  it("rejects expired claims", async () => {
    const amount = new BN(1_000_000);
    const expiry = new BN(Math.floor(Date.now() / 1000) - 5);
    const expiredClaimId = Array.from(Buffer.alloc(32, 9));
    const expiredClaimIdBuffer = Buffer.from(expiredClaimId);
    const [claimRecordPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("claim-record"), expiredClaimIdBuffer],
      program.programId
    );

    const message = Buffer.concat([
      player.publicKey.toBuffer(),
      depositPoolPda.toBuffer(),
      amount.toArrayLike(Buffer, "le", 8),
      expiredClaimIdBuffer,
      expiry.toArrayLike(Buffer, "le", 8),
    ]);

    const ed25519Ix = Ed25519Program.createInstructionWithPrivateKey({
      privateKey: replacementConvexAuthority.secretKey,
      message,
    });

    await expectFailure(
      program.methods
        .claim(amount, expiredClaimId, expiry)
        .accounts({
          player: player.publicKey,
          vaultConfig: vaultConfigPda,
          mint,
          depositPool: depositPoolPda,
          claimRecord: claimRecordPda,
          vaultAta,
          playerTokenAccount: playerAta,
          instructionsSysvar: web3.SYSVAR_INSTRUCTIONS_PUBKEY,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .preInstructions([ed25519Ix])
        .signers([player])
        .rpc(),
      "Claim has expired"
    );
  });

  it("supports Token-2022 pools for register, deposit, and claim", async () => {
    await program.methods
      .registerPool()
      .accounts({
        depositor: depositor.publicKey,
        mint: token2022Mint,
        depositPool: token2022DepositPoolPda,
        vaultAta: token2022VaultAta,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([depositor])
      .rpc();

    await program.methods
      .deposit(new BN(200_000_000))
      .accounts({
        depositor: depositor.publicKey,
        mint: token2022Mint,
        depositPool: token2022DepositPoolPda,
        depositorTokenAccount: token2022DepositorAta,
        vaultAta: token2022VaultAta,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([depositor])
      .rpc();

    const claimAmount = new BN(50_000_000);
    const expiry = new BN(Math.floor(Date.now() / 1000) + 60);
    const token2022ClaimId = Array.from(Buffer.alloc(32, 11));
    const token2022ClaimIdBuffer = Buffer.from(token2022ClaimId);
    const [claimRecordPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("claim-record"), token2022ClaimIdBuffer],
      program.programId
    );
    const message = Buffer.concat([
      player.publicKey.toBuffer(),
      token2022DepositPoolPda.toBuffer(),
      claimAmount.toArrayLike(Buffer, "le", 8),
      token2022ClaimIdBuffer,
      expiry.toArrayLike(Buffer, "le", 8),
    ]);
    const ed25519Ix = Ed25519Program.createInstructionWithPrivateKey({
      privateKey: replacementConvexAuthority.secretKey,
      message,
    });

    await program.methods
      .claim(claimAmount, token2022ClaimId, expiry)
      .accounts({
        player: player.publicKey,
        vaultConfig: vaultConfigPda,
        mint: token2022Mint,
        depositPool: token2022DepositPoolPda,
        claimRecord: claimRecordPda,
        vaultAta: token2022VaultAta,
        playerTokenAccount: token2022PlayerAta,
        instructionsSysvar: web3.SYSVAR_INSTRUCTIONS_PUBKEY,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .preInstructions([ed25519Ix])
      .signers([player])
      .rpc();

    const pool = await accounts.depositPool.fetch(token2022DepositPoolPda);
    const playerAccount = await getAccount(
      provider.connection,
      token2022PlayerAta,
      "confirmed",
      TOKEN_2022_PROGRAM_ID
    );

    expect(pool.totalDeposited.toString()).to.eq("200000000");
    expect(pool.remaining.toString()).to.eq("150000000");
    expect(playerAccount.amount).to.eq(BigInt("50000000"));
  });

  it("routes the pool leg into Meteora via the configured pool", async function () {
    const meteoraAccounts = await deriveMeteoraGamePaymentAccounts();
    if (!meteoraAccounts) {
      this.skip();
      return;
    }

    const amount = new BN(250_000_000);
    const beforeOperational = await provider.connection.getBalance(
      operationalWallet.publicKey
    );
    const beforeOperator = await provider.connection.getBalance(
      operatorWallet.publicKey
    );
    const beforePosition = await provider.connection.getAccountInfo(
      meteoraAccounts.position
    );

    await program.methods
      .gamePayment(amount)
      .accounts({
        player: player.publicKey,
        vaultConfig: vaultConfigPda,
        operationalWallet: operationalWallet.publicKey,
        operatorWallet: operatorWallet.publicKey,
        ...meteoraAccounts,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([player])
      .rpc();

    const afterOperational = await provider.connection.getBalance(
      operationalWallet.publicKey
    );
    const afterOperator = await provider.connection.getBalance(
      operatorWallet.publicKey
    );
    const afterPosition = await provider.connection.getAccountInfo(
      meteoraAccounts.position
    );

    expect(afterOperational - beforeOperational).to.eq(100_000_000);
    expect(afterOperator - beforeOperator).to.eq(62_500_000);
    expect(afterPosition).to.not.eq(null);
    if (!beforePosition) {
      const positionNftAccount = await provider.connection.getAccountInfo(
        meteoraAccounts.positionNftAccount
      );
      expect(positionNftAccount).to.not.eq(null);
    }
  });
});
