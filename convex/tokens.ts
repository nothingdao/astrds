"use node"

import { action } from './_generated/server'
import { v } from 'convex/values'
import { Connection, Keypair, PublicKey } from '@solana/web3.js'
import {
  mintTo,
  getOrCreateAssociatedTokenAccount,
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

    const authority = loadAuthority()
    const connection = new Connection(
      process.env.SOLANA_DEVNET_RPC_ENDPOINT ?? 'https://api.devnet.solana.com',
      'confirmed'
    )

    const playerPubkey = new PublicKey(playerPublicKey)

    const tokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      authority,
      MINT_ADDRESS,
      playerPubkey
    )

    const amount = BigInt(tokenCount) * BigInt(10 ** TOKEN_DECIMALS)

    const signature = await mintTo(
      connection,
      authority,
      MINT_ADDRESS,
      tokenAccount.address,
      authority,
      amount
    )

    return { success: true, signature }
  },
})
