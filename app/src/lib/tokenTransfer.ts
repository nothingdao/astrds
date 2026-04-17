// src/lib/tokenTransfer.ts
// Build the unsigned SPL transfer transaction a player signs to send tokens into space

import { Connection, PublicKey, Transaction } from '@solana/web3.js'
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token'
import { RPC_ENDPOINT } from '@/lib/solana'

// Deposits go to the authority wallet — it holds the private key and can sign outbound claims.
const TREASURY_PUBKEY = new PublicKey('CNhWD1cXNaCMcjJmFcK25aFgV3ZTAFtyFDBvGfKZcpzF')

export async function buildSendToSpaceTransaction(
  playerPublicKey: PublicKey,
  mintAddress: string,
  rawAmount: number,   // raw token units (no decimals)
  programId: 'TOKEN' | 'TOKEN_2022'
): Promise<Transaction> {
  const connection = new Connection(RPC_ENDPOINT, 'confirmed')
  const mintPubkey = new PublicKey(mintAddress)
  const tokenProgramId = programId === 'TOKEN_2022' ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID

  const playerAta = getAssociatedTokenAddressSync(
    mintPubkey,
    playerPublicKey,
    false,
    tokenProgramId,
    ASSOCIATED_TOKEN_PROGRAM_ID
  )

  const treasuryAta = getAssociatedTokenAddressSync(
    mintPubkey,
    TREASURY_PUBKEY,
    false,
    tokenProgramId,
    ASSOCIATED_TOKEN_PROGRAM_ID
  )

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()

  const tx = new Transaction({
    feePayer: playerPublicKey,
    blockhash,
    lastValidBlockHeight,
  }).add(
    // Create treasury ATA if it doesn't exist yet (player pays rent)
    createAssociatedTokenAccountIdempotentInstruction(
      playerPublicKey,
      treasuryAta,
      TREASURY_PUBKEY,
      mintPubkey,
      tokenProgramId,
      ASSOCIATED_TOKEN_PROGRAM_ID
    ),
    createTransferInstruction(
      playerAta,
      treasuryAta,
      playerPublicKey,
      BigInt(rawAmount),
      [],
      tokenProgramId
    )
  )

  return tx
}
