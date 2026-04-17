"use node"

import { action } from './_generated/server'
import { v } from 'convex/values'
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js'
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
  createMintToInstruction,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token'

const MINT_ADDRESS = new PublicKey('5sqKSHDKZr4KbNzj972PSfmEhtR9eLeBvv1nBRbeQAnB')
const TOKEN_DECIMALS = 9

const loadAuthority = (): Keypair => {
  const raw = process.env.PROGRAM_AUTHORITY_PRIVATE_KEY
  if (!raw) throw new Error('PROGRAM_AUTHORITY_PRIVATE_KEY not set')
  return Keypair.fromSecretKey(new Uint8Array(JSON.parse(raw)))
}

export const mintTokens = action({
  args: {
    playerPublicKey: v.string(),
    tokenCount: v.number(),
  },
  handler: async (_ctx, { playerPublicKey, tokenCount }) => {
    if (tokenCount <= 0 || tokenCount > 200) throw new Error('Invalid token count')

    const rpcEndpoint = process.env.SOLANA_RPC_ENDPOINT
    if (!rpcEndpoint) throw new Error('SOLANA_RPC_ENDPOINT not set')

    const authority = loadAuthority()
    const connection = new Connection(rpcEndpoint, 'confirmed')
    const playerPubkey = new PublicKey(playerPublicKey)

    const ata = getAssociatedTokenAddressSync(
      MINT_ADDRESS,
      playerPubkey,
      false,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    )

    const amount = BigInt(tokenCount) * BigInt(10 ** TOKEN_DECIMALS)

    const tx = new Transaction().add(
      // Idempotent — no-ops if ATA already exists
      createAssociatedTokenAccountIdempotentInstruction(
        authority.publicKey,
        ata,
        playerPubkey,
        MINT_ADDRESS,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      ),
      createMintToInstruction(
        MINT_ADDRESS,
        ata,
        authority.publicKey,
        amount,
        [],
        TOKEN_2022_PROGRAM_ID
      )
    )

    const signature = await sendAndConfirmTransaction(connection, tx, [authority])

    return { success: true, signature }
  },
})
