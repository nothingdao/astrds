import {
  AnchorProvider,
  BN,
  Program,
  type Wallet as AnchorWallet,
} from '@coral-xyz/anchor'
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token'
import {
  Connection,
  Ed25519Program,
  Keypair,
  PublicKey,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  SystemProgram,
  Transaction,
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

const createReadonlyWallet = (publicKey?: PublicKey): AnchorWallet => ({
  publicKey: publicKey ?? Keypair.generate().publicKey,
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

export const findDepositPoolPda = (depositor: PublicKey, mint: PublicKey) =>
  PublicKey.findProgramAddressSync(
    [DEPOSIT_POOL_SEED, depositor.toBuffer(), mint.toBuffer()],
    PROGRAM_ID
  )

export const findClaimRecordPda = (claimId: Uint8Array) =>
  PublicKey.findProgramAddressSync([CLAIM_RECORD_SEED, Buffer.from(claimId)], PROGRAM_ID)

export const fetchVaultConfig = async (connection: Connection) => {
  const program = getSpaceVaultProgram(connection)
  const [vaultConfig] = findVaultConfigPda()
  return program.account.vaultConfig.fetch(vaultConfig)
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
        })
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
      })
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
      })
      .instruction()
  )

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed')
  tx.feePayer = player
  tx.recentBlockhash = blockhash

  return { transaction: tx, blockhash, lastValidBlockHeight }
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
  const program = getSpaceVaultProgram(connection, player)
  const [vaultConfig] = findVaultConfigPda()
  const config = await fetchVaultConfig(connection)

  const tx = new Transaction().add(
    await program.methods
      .gamePayment(new BN(lamports))
      .accounts({
        player,
        vaultConfig,
        operationalWallet: config.operationalWallet,
        operatorWallet: config.operatorWallet,
        buybackWallet: config.buybackWallet,
        systemProgram: SystemProgram.programId,
      })
      .instruction()
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
