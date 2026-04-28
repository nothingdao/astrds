import {
  AnchorProvider,
  BN,
  Program,
  type Wallet as AnchorWallet,
} from '@coral-xyz/anchor'
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createCloseAccountInstruction,
  createSyncNativeInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token'
import {
  ComputeBudgetProgram,
  Connection,
  Ed25519Program,
  Keypair,
  PublicKey,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  type TransactionSignature,
} from '@solana/web3.js'
import idl from '@/lib/idl/space_vault_program.json'
import type { SpaceVaultProgram } from '@/lib/idl/space_vault_program'

export type TokenProgramKind = 'TOKEN' | 'TOKEN_2022'

export interface PreparedClaim {
  depositId: string
  collectionIds: string[]
  poolAddress: string
  mintAddress: string
  programId: string
  symbol: string
  decimals: number
  totalAmount: number
  claimId: number[]
  expiry: number
  signature: number[]
}

const IDL = idl as SpaceVaultProgram
const PROGRAM_ID = new PublicKey(IDL.address)
const enc = new TextEncoder()
const VAULT_CONFIG_SEED = enc.encode('vault-config')
const DEPOSIT_POOL_SEED = enc.encode('deposit-pool')
const CLAIM_RECORD_SEED = enc.encode('claim-record')
const MINT_RECORD_SEED = enc.encode('mint-record')
const BUYBACK_VAULT_SEED = enc.encode('buyback-vault')
const ASTRDS_MINT = new PublicKey('5sqKSHDKZr4KbNzj972PSfmEhtR9eLeBvv1nBRbeQAnB')
const MINT_ASTRDS_DISCRIMINATOR = Buffer.from([235, 159, 204, 255, 238, 250, 247, 223])
const METEORA_POSITION_NFT_MINT_SEED = enc.encode('meteora-position-mint')
const METEORA_POSITION_SEED = enc.encode('position')
const METEORA_POSITION_NFT_ACCOUNT_SEED = enc.encode('position_nft_account')
const METEORA_EVENT_AUTHORITY_SEED = enc.encode('__event_authority')
const METEORA_PROGRAM_ID = new PublicKey('cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG')
const METEORA_POOL_AUTHORITY = new PublicKey('HLnpSz9h2S4hiLQ43rnSD9XkcUThA7B8hQMKmDaiTLcC')
const POOL_ACCOUNT_DISCRIMINATOR_SIZE = 8
const POOL_FEES_STRUCT_SIZE = 160
const PUBLIC_KEY_SIZE = 32
const TOKEN_A_MINT_OFFSET = POOL_ACCOUNT_DISCRIMINATOR_SIZE + POOL_FEES_STRUCT_SIZE
const TOKEN_B_MINT_OFFSET = TOKEN_A_MINT_OFFSET + PUBLIC_KEY_SIZE
const TOKEN_A_VAULT_OFFSET = TOKEN_B_MINT_OFFSET + PUBLIC_KEY_SIZE
const TOKEN_B_VAULT_OFFSET = TOKEN_A_VAULT_OFFSET + PUBLIC_KEY_SIZE
const DEVNET_GENESIS_HASH = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG'
let devnetCheck: Promise<void> | null = null

const assertDevnet = async (connection: Connection) => {
  devnetCheck ??= connection.getGenesisHash().then((hash) => {
    if (hash !== DEVNET_GENESIS_HASH) {
      throw new Error(`ASTRDS is configured for Solana devnet. Refusing to build transaction on cluster genesis ${hash}.`)
    }
  })
  await devnetCheck
}

const createReadonlyWallet = (publicKey?: PublicKey): AnchorWallet => ({
  publicKey: publicKey ?? Keypair.generate().publicKey,
  payer: Keypair.generate(),
  signTransaction: async () => {
    throw new Error('Readonly provider cannot sign transactions')
  },
  signAllTransactions: async () => {
    throw new Error('Readonly provider cannot sign transactions')
  },
})

const createProvider = (connection: Connection, publicKey?: PublicKey) =>
  new AnchorProvider(connection, createReadonlyWallet(publicKey), {
    commitment: 'confirmed',
    preflightCommitment: 'confirmed',
  })

export const getTokenProgramId = (programId: TokenProgramKind | string) =>
  programId === 'TOKEN_2022' ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID

export const getSpaceVaultProgram = (connection: Connection, publicKey?: PublicKey) =>
  new Program<SpaceVaultProgram>(IDL, createProvider(connection, publicKey))

export const findVaultConfigPda = () =>
  PublicKey.findProgramAddressSync([VAULT_CONFIG_SEED], PROGRAM_ID)

export const findBuybackVaultPda = () =>
  PublicKey.findProgramAddressSync([BUYBACK_VAULT_SEED], PROGRAM_ID)

export const findDepositPoolPda = (depositor: PublicKey, mint: PublicKey) =>
  PublicKey.findProgramAddressSync(
    [DEPOSIT_POOL_SEED, depositor.toBuffer(), mint.toBuffer()],
    PROGRAM_ID
  )

export const findClaimRecordPda = (claimId: Uint8Array) =>
  PublicKey.findProgramAddressSync([CLAIM_RECORD_SEED, Buffer.from(claimId)], PROGRAM_ID)

export const findMintRecordPda = (sessionId: Uint8Array) =>
  PublicKey.findProgramAddressSync([MINT_RECORD_SEED, Buffer.from(sessionId)], PROGRAM_ID)

export const findMeteoraPositionNftMintPda = () =>
  PublicKey.findProgramAddressSync([METEORA_POSITION_NFT_MINT_SEED], PROGRAM_ID)

export const findMeteoraPositionPda = (positionNftMint: PublicKey) =>
  PublicKey.findProgramAddressSync([METEORA_POSITION_SEED, positionNftMint.toBuffer()], METEORA_PROGRAM_ID)

export const findMeteoraPositionNftAccountPda = (positionNftMint: PublicKey) =>
  PublicKey.findProgramAddressSync(
    [METEORA_POSITION_NFT_ACCOUNT_SEED, positionNftMint.toBuffer()],
    METEORA_PROGRAM_ID
  )

export const findMeteoraEventAuthorityPda = () =>
  PublicKey.findProgramAddressSync([METEORA_EVENT_AUTHORITY_SEED], METEORA_PROGRAM_ID)

function readPublicKey(data: Uint8Array, offset: number): PublicKey {
  return new PublicKey(data.subarray(offset, offset + PUBLIC_KEY_SIZE))
}

async function loadTokenProgramForMint(connection: Connection, mint: PublicKey): Promise<PublicKey> {
  const mintAccount = await connection.getAccountInfo(mint, 'confirmed')
  if (!mintAccount) {
    throw new Error(`Mint account not found: ${mint.toBase58()}`)
  }

  if (mintAccount.owner.equals(TOKEN_2022_PROGRAM_ID)) {
    return TOKEN_2022_PROGRAM_ID
  }

  return TOKEN_PROGRAM_ID
}

async function loadMeteoraPoolAccounts(connection: Connection, meteoraPool: PublicKey) {
  const poolAccount = await connection.getAccountInfo(meteoraPool, 'confirmed')
  if (!poolAccount) {
    throw new Error(`Meteora pool account not found: ${meteoraPool.toBase58()}`)
  }

  const data = new Uint8Array(poolAccount.data)
  const tokenAMint = readPublicKey(data, TOKEN_A_MINT_OFFSET)
  const tokenBMint = readPublicKey(data, TOKEN_B_MINT_OFFSET)
  const tokenAVault = readPublicKey(data, TOKEN_A_VAULT_OFFSET)
  const tokenBVault = readPublicKey(data, TOKEN_B_VAULT_OFFSET)
  const [tokenAProgram, tokenBProgram] = await Promise.all([
    loadTokenProgramForMint(connection, tokenAMint),
    loadTokenProgramForMint(connection, tokenBMint),
  ])

  return {
    tokenAMint,
    tokenBMint,
    tokenAVault,
    tokenBVault,
    tokenAProgram,
    tokenBProgram,
  }
}

export const fetchVaultConfig = async (connection: Connection) => {
  await assertDevnet(connection)
  const [vaultConfig] = findVaultConfigPda()
  const account = await connection.getAccountInfo(vaultConfig, 'confirmed')
  if (!account) {
    throw new Error(`VaultConfig account not found: ${vaultConfig.toBase58()}`)
  }

  // Decode manually instead of using Anchor's account fetch. In browser builds,
  // Anchor's coder path can hang around the Buffer polyfill, which prevents the
  // wallet approval request from ever being reached.
  const data = new Uint8Array(account.data)
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  const readU16 = (offset: number) => view.getUint16(offset, true)
  const readU64 = (offset: number) => view.getBigUint64(offset, true)

  return {
    authority: readPublicKey(data, 8),
    paymentWeights: {
      operationalBps: readU16(40),
      operatorBps: readU16(42),
      buybackBps: readU16(44),
    },
    reserved: readU64(46),
    convexAuthority: readPublicKey(data, 54),
    operationalWallet: readPublicKey(data, 86),
    operatorWallet: readPublicKey(data, 118),
    meteoraPool: readPublicKey(data, 150),
    bump: data[182],
  }
}

export const fetchDepositPool = async (connection: Connection, poolAddress: PublicKey) => {
  const program = getSpaceVaultProgram(connection)
  return program.account.depositPool.fetchNullable(poolAddress)
}

export const buildClaimMessage = (
  player: PublicKey,
  pool: PublicKey,
  amount: number,
  claimId: Uint8Array,
  expiry: number
) => {
  const message = new Uint8Array(112)
  const view = new DataView(message.buffer)
  message.set(player.toBytes(), 0)
  message.set(pool.toBytes(), 32)
  view.setBigUint64(64, BigInt(amount), true)
  message.set(claimId, 72)
  view.setBigInt64(104, BigInt(expiry), true)
  return message
}

export const buildSendToSpaceTransaction = async ({
  connection,
  depositor,
  mintAddress,
  rawAmount,
  programId,
}: {
  connection: Connection
  depositor: PublicKey
  mintAddress: string
  rawAmount: number
  programId: TokenProgramKind
}) => {
  const program = getSpaceVaultProgram(connection, depositor)
  const mint = new PublicKey(mintAddress)
  const tokenProgram = getTokenProgramId(programId)
  const [depositPool] = findDepositPoolPda(depositor, mint)
  const vaultAta = getAssociatedTokenAddressSync(
    mint,
    depositPool,
    true,
    tokenProgram,
    ASSOCIATED_TOKEN_PROGRAM_ID
  )
  const depositorTokenAccount = getAssociatedTokenAddressSync(
    mint,
    depositor,
    false,
    tokenProgram,
    ASSOCIATED_TOKEN_PROGRAM_ID
  )

  const tx = new Transaction()
  const poolAccount = await connection.getAccountInfo(depositPool, 'confirmed')

  if (!poolAccount) {
    tx.add(
      await program.methods
        .registerPool()
        .accounts({
          depositor,
          mint,
          depositPool,
          vaultAta,
          tokenProgram,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        } as any)
        .instruction()
    )
  }

  tx.add(
    await program.methods
      .deposit(new BN(rawAmount))
      .accounts({
        depositor,
        mint,
        depositPool,
        depositorTokenAccount,
        vaultAta,
        tokenProgram,
      } as any)
      .instruction()
  )

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed')
  tx.feePayer = depositor
  tx.recentBlockhash = blockhash

  return {
    transaction: tx,
    poolAddress: depositPool,
    blockhash,
    lastValidBlockHeight,
  }
}

export const buildClaimTransaction = async ({
  connection,
  player,
  claim,
}: {
  connection: Connection
  player: PublicKey
  claim: PreparedClaim
}) => {
  const program = getSpaceVaultProgram(connection, player)
  const mint = new PublicKey(claim.mintAddress)
  const depositPool = new PublicKey(claim.poolAddress)
  const tokenProgram = getTokenProgramId(claim.programId)
  const [vaultConfig] = findVaultConfigPda()
  const [claimRecord] = findClaimRecordPda(Uint8Array.from(claim.claimId))
  const vaultAta = getAssociatedTokenAddressSync(
    mint,
    depositPool,
    true,
    tokenProgram,
    ASSOCIATED_TOKEN_PROGRAM_ID
  )
  const playerTokenAccount = getAssociatedTokenAddressSync(
    mint,
    player,
    false,
    tokenProgram,
    ASSOCIATED_TOKEN_PROGRAM_ID
  )
  const vaultConfigAccount = await fetchVaultConfig(connection)
  const message = buildClaimMessage(
    player,
    depositPool,
    claim.totalAmount,
    Uint8Array.from(claim.claimId),
    claim.expiry
  )

  const tx = new Transaction().add(
    Ed25519Program.createInstructionWithPublicKey({
      publicKey: vaultConfigAccount.convexAuthority.toBytes(),
      message,
      signature: Uint8Array.from(claim.signature),
    }),
    await program.methods
      .claim(
        new BN(claim.totalAmount),
        [...claim.claimId],
        new BN(claim.expiry)
      )
      .accounts({
        player,
        vaultConfig,
        mint,
        depositPool,
        claimRecord,
        vaultAta,
        playerTokenAccount,
        instructionsSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
        tokenProgram,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      } as any)
      .instruction()
  )

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed')
  tx.feePayer = player
  tx.recentBlockhash = blockhash

  return { transaction: tx, blockhash, lastValidBlockHeight }
}

const GAME_PAYMENT_DISCRIMINATOR = Buffer.from([44, 5, 226, 247, 176, 177, 31, 183])
const CRANK_LIQUIDITY_DISCRIMINATOR = Buffer.from([1, 222, 14, 191, 61, 205, 81, 198])
const METEORA_SWAP_DISCRIMINATOR = Buffer.from([248, 198, 158, 145, 225, 117, 135, 200])

export type MeteoraSwapDirection = 'buy' | 'sell'

export const fetchLiquidityCrankState = async (connection: Connection) => {
  await assertDevnet(connection)
  const [vaultConfig] = findVaultConfigPda()
  const [buybackVault] = findBuybackVaultPda()
  const [positionNftMint] = findMeteoraPositionNftMintPda()
  const [position] = findMeteoraPositionPda(positionNftMint)
  const [positionNftAccount] = findMeteoraPositionNftAccountPda(positionNftMint)
  const [buybackVaultAccount, positionAccount, positionNftAccountInfo] = await Promise.all([
    connection.getAccountInfo(buybackVault, 'confirmed'),
    connection.getAccountInfo(position, 'confirmed'),
    connection.getAccountInfo(positionNftAccount, 'confirmed'),
  ])
  const pendingLamports = buybackVaultAccount?.lamports ?? 0

  return {
    vaultConfig,
    buybackVault,
    position,
    positionNftAccount,
    pendingLamports,
    pendingSol: pendingLamports / 1e9,
    rentReserveLamports: 0,
    positionExists: !!positionAccount,
    positionLocked: !!positionNftAccountInfo,
  }
}

export const buildGamePaymentTransaction = async ({
  connection,
  player,
  lamports,
}: {
  connection: Connection
  player: PublicKey
  lamports: number
}) => {
  await assertDevnet(connection)
  const [vaultConfig] = findVaultConfigPda()
  const [buybackVault] = findBuybackVaultPda()
  const config = await fetchVaultConfig(connection)
  const amountData = Buffer.alloc(8)
  amountData.writeBigUInt64LE(BigInt(lamports))
  const data = Buffer.concat([GAME_PAYMENT_DISCRIMINATOR, amountData])

  // Keep insert-quarter boring: collect payment shares only. Buyback SOL accrues
  // in the VaultConfig PDA and is processed by crank_liquidity separately.
  const ix = new TransactionInstruction({
    programId: PROGRAM_ID,
    data,
    keys: [
      { pubkey: player,                   isSigner: true,  isWritable: true  },
      { pubkey: vaultConfig,              isSigner: false, isWritable: true  },
      { pubkey: config.operationalWallet, isSigner: false, isWritable: true  },
      { pubkey: config.operatorWallet,    isSigner: false, isWritable: true  },
      { pubkey: buybackVault,             isSigner: false, isWritable: true  },
      { pubkey: SystemProgram.programId,  isSigner: false, isWritable: false },
    ],
  })

  const tx = new Transaction().add(ix)
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed')
  tx.feePayer = player
  tx.recentBlockhash = blockhash

  return { transaction: tx, blockhash, lastValidBlockHeight }
}

export const buildCrankLiquidityTransaction = async ({
  connection,
  cranker,
  lamports,
}: {
  connection: Connection
  cranker: PublicKey
  lamports: number
}) => {
  await assertDevnet(connection)
  const [vaultConfig] = findVaultConfigPda()
  const [buybackVault] = findBuybackVaultPda()
  const config = await fetchVaultConfig(connection)
  const meteoraPool = config.meteoraPool
  const {
    tokenAMint,
    tokenBMint,
    tokenAVault,
    tokenBVault,
    tokenAProgram,
    tokenBProgram,
  } = await loadMeteoraPoolAccounts(connection, meteoraPool)
  const [positionNftMint] = findMeteoraPositionNftMintPda()
  const [position] = findMeteoraPositionPda(positionNftMint)
  const [positionNftAccount] = findMeteoraPositionNftAccountPda(positionNftMint)
  const [eventAuthority] = findMeteoraEventAuthorityPda()
  const vaultConfigTokenAAccount = getAssociatedTokenAddressSync(
    tokenAMint,
    vaultConfig,
    true,
    tokenAProgram,
    ASSOCIATED_TOKEN_PROGRAM_ID
  )
  const vaultConfigTokenBAccount = getAssociatedTokenAddressSync(
    tokenBMint,
    vaultConfig,
    true,
    tokenBProgram,
    ASSOCIATED_TOKEN_PROGRAM_ID
  )

  const amountData = Buffer.alloc(8)
  amountData.writeBigUInt64LE(BigInt(lamports))
  const data = Buffer.concat([CRANK_LIQUIDITY_DISCRIMINATOR, amountData])

  const ix = new TransactionInstruction({
    programId: PROGRAM_ID,
    data,
    keys: [
      { pubkey: cranker,                   isSigner: true,  isWritable: true  },
      { pubkey: vaultConfig,               isSigner: false, isWritable: true  },
      { pubkey: buybackVault,              isSigner: false, isWritable: true  },
      { pubkey: meteoraPool,               isSigner: false, isWritable: true  },
      { pubkey: positionNftMint,           isSigner: false, isWritable: true  },
      { pubkey: position,                  isSigner: false, isWritable: true  },
      { pubkey: positionNftAccount,        isSigner: false, isWritable: true  },
      { pubkey: tokenAMint,                isSigner: false, isWritable: false },
      { pubkey: tokenBMint,                isSigner: false, isWritable: false },
      { pubkey: vaultConfigTokenAAccount,  isSigner: false, isWritable: true  },
      { pubkey: vaultConfigTokenBAccount,  isSigner: false, isWritable: true  },
      { pubkey: tokenAVault,               isSigner: false, isWritable: true  },
      { pubkey: tokenBVault,               isSigner: false, isWritable: true  },
      { pubkey: METEORA_POOL_AUTHORITY,    isSigner: false, isWritable: false },
      { pubkey: eventAuthority,            isSigner: false, isWritable: false },
      { pubkey: METEORA_PROGRAM_ID,        isSigner: false, isWritable: false },
      { pubkey: TOKEN_2022_PROGRAM_ID,     isSigner: false, isWritable: false },
      { pubkey: tokenAProgram,             isSigner: false, isWritable: false },
      { pubkey: tokenBProgram,             isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId,   isSigner: false, isWritable: false },
    ],
  })

  const tx = new Transaction().add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 800_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1_000 }),
    ix
  )

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed')
  tx.feePayer = cranker
  tx.recentBlockhash = blockhash

  return { transaction: tx, blockhash, lastValidBlockHeight }
}

export const buildMeteoraSwapTransaction = async ({
  connection,
  user,
  direction,
  rawAmountIn,
  minimumAmountOut = 0,
}: {
  connection: Connection
  user: PublicKey
  direction: MeteoraSwapDirection
  rawAmountIn: number | bigint
  minimumAmountOut?: number | bigint
}) => {
  await assertDevnet(connection)
  const config = await fetchVaultConfig(connection)
  const meteoraPool = config.meteoraPool
  const {
    tokenAMint,
    tokenBMint,
    tokenAVault,
    tokenBVault,
    tokenAProgram,
    tokenBProgram,
  } = await loadMeteoraPoolAccounts(connection, meteoraPool)
  const [eventAuthority] = findMeteoraEventAuthorityPda()

  const userTokenA = getAssociatedTokenAddressSync(
    tokenAMint,
    user,
    false,
    tokenAProgram,
    ASSOCIATED_TOKEN_PROGRAM_ID
  )
  const userTokenB = getAssociatedTokenAddressSync(
    tokenBMint,
    user,
    false,
    tokenBProgram,
    ASSOCIATED_TOKEN_PROGRAM_ID
  )

  const amountData = Buffer.alloc(16)
  amountData.writeBigUInt64LE(BigInt(rawAmountIn), 0)
  amountData.writeBigUInt64LE(BigInt(minimumAmountOut), 8)
  const swapIx = new TransactionInstruction({
    programId: METEORA_PROGRAM_ID,
    data: Buffer.concat([METEORA_SWAP_DISCRIMINATOR, amountData]),
    keys: [
      { pubkey: METEORA_POOL_AUTHORITY, isSigner: false, isWritable: false },
      { pubkey: meteoraPool,            isSigner: false, isWritable: true  },
      { pubkey: direction === 'buy' ? userTokenB : userTokenA, isSigner: false, isWritable: true },
      { pubkey: direction === 'buy' ? userTokenA : userTokenB, isSigner: false, isWritable: true },
      { pubkey: tokenAVault,            isSigner: false, isWritable: true  },
      { pubkey: tokenBVault,            isSigner: false, isWritable: true  },
      { pubkey: tokenAMint,             isSigner: false, isWritable: false },
      { pubkey: tokenBMint,             isSigner: false, isWritable: false },
      { pubkey: user,                   isSigner: true,  isWritable: false },
      { pubkey: tokenAProgram,          isSigner: false, isWritable: false },
      { pubkey: tokenBProgram,          isSigner: false, isWritable: false },
      { pubkey: METEORA_PROGRAM_ID,     isSigner: false, isWritable: false },
      { pubkey: eventAuthority,         isSigner: false, isWritable: false },
      { pubkey: METEORA_PROGRAM_ID,     isSigner: false, isWritable: false },
    ],
  })

  const existingUserTokenB = await connection.getAccountInfo(userTokenB, 'confirmed')
  const tx = new Transaction().add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1_000 }),
    createAssociatedTokenAccountIdempotentInstruction(user, userTokenA, user, tokenAMint, tokenAProgram),
    createAssociatedTokenAccountIdempotentInstruction(user, userTokenB, user, tokenBMint, tokenBProgram)
  )

  if (direction === 'buy') {
    tx.add(
      SystemProgram.transfer({ fromPubkey: user, toPubkey: userTokenB, lamports: Number(rawAmountIn) }),
      createSyncNativeInstruction(userTokenB, tokenBProgram)
    )
  }

  tx.add(swapIx)

  // Token B is WSOL in the configured pool. For newly-created buy-side WSOL ATAs,
  // close after the swap to return rent. If the user already had a WSOL ATA, leave
  // it alone; closing an existing account can make wallet simulation fail and is
  // surprising UX. Sell-side closes to unwrap the received WSOL into normal SOL.
  if (direction === 'sell' || !existingUserTokenB) {
    tx.add(createCloseAccountInstruction(userTokenB, user, user, [], tokenBProgram))
  }

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed')
  tx.feePayer = user
  tx.recentBlockhash = blockhash

  return { transaction: tx, blockhash, lastValidBlockHeight }
}

export interface PreparedMint {
  amount: string
  sessionId: number[]
  expiry: number
  signature: number[]
}

export const buildMintAstrdsMessage = (
  player: PublicKey,
  amount: bigint,
  sessionId: Uint8Array,
  expiry: number
) => {
  // player(32) || amount(8) || session_id(32) || expiry(8) = 80 bytes
  const message = new Uint8Array(80)
  const view = new DataView(message.buffer)
  message.set(player.toBytes(), 0)
  view.setBigUint64(32, amount, true)
  message.set(sessionId, 40)
  view.setBigInt64(72, BigInt(expiry), true)
  return message
}

export const buildMintAstrdsTransaction = async ({
  connection,
  player,
  mint: mintData,
}: {
  connection: Connection
  player: PublicKey
  mint: PreparedMint
}) => {
  await assertDevnet(connection)
  const [vaultConfig] = findVaultConfigPda()
  const sessionId = Uint8Array.from(mintData.sessionId)
  const [mintRecord] = findMintRecordPda(sessionId)
  const amount = BigInt(mintData.amount)

  const vaultConfigAccount = await fetchVaultConfig(connection)

  const playerTokenAccount = getAssociatedTokenAddressSync(
    ASTRDS_MINT,
    player,
    false,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  )

  const message = buildMintAstrdsMessage(player, amount, sessionId, mintData.expiry)

  // Instruction data: discriminator(8) || amount(8) || session_id(32) || expiry(8) = 56 bytes
  const argsBuffer = Buffer.alloc(48)
  const argsView = new DataView(argsBuffer.buffer)
  argsView.setBigUint64(0, amount, true)
  argsBuffer.set(sessionId, 8)
  argsView.setBigInt64(40, BigInt(mintData.expiry), true)
  const data = Buffer.concat([MINT_ASTRDS_DISCRIMINATOR, argsBuffer])

  const ix = new TransactionInstruction({
    programId: PROGRAM_ID,
    data,
    keys: [
      { pubkey: player,                       isSigner: true,  isWritable: true  },
      { pubkey: vaultConfig,                  isSigner: false, isWritable: false },
      { pubkey: ASTRDS_MINT,                  isSigner: false, isWritable: true  },
      { pubkey: playerTokenAccount,           isSigner: false, isWritable: true  },
      { pubkey: mintRecord,                   isSigner: false, isWritable: true  },
      { pubkey: SYSVAR_INSTRUCTIONS_PUBKEY,   isSigner: false, isWritable: false },
      { pubkey: TOKEN_2022_PROGRAM_ID,        isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID,  isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId,      isSigner: false, isWritable: false },
    ],
  })

  const tx = new Transaction().add(
    Ed25519Program.createInstructionWithPublicKey({
      publicKey: vaultConfigAccount.convexAuthority.toBytes(),
      message,
      signature: Uint8Array.from(mintData.signature),
    }),
    ix
  )

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed')
  tx.feePayer = player
  tx.recentBlockhash = blockhash

  return { transaction: tx, blockhash, lastValidBlockHeight }
}

export const sendSignedTransaction = async ({
  connection,
  signedTransaction,
  blockhash,
  lastValidBlockHeight,
}: {
  connection: Connection
  signedTransaction: Transaction
  blockhash: string
  lastValidBlockHeight: number
}): Promise<TransactionSignature> => {
  const signature = await connection.sendRawTransaction(signedTransaction.serialize(), {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  })

  await connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    'confirmed'
  )

  return signature
}
