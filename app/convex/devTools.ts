"use node"

// Dev-only: mint a test SPL Token-2022 with on-chain metadata.
// Uses two transactions: (1) create mint + MetadataPointer + mintTo, (2) init TokenMetadata.
// Token-2022 handles auto-realloc of the mint account for the metadata TLV.

import { action } from './_generated/server'
import { v } from 'convex/values'
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
} from '@solana/web3.js'
import {
  createInitializeMintInstruction,
  createInitializeMetadataPointerInstruction,
  createAssociatedTokenAccountIdempotentInstruction,
  createMintToInstruction,
  tokenMetadataInitializeWithRentTransfer,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getMintLen,
  ExtensionType,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token'

const BASE_URL = 'https://astrds.ndao.computer'

const loadAuthority = (): Keypair => {
  const raw = process.env.PROGRAM_AUTHORITY_PRIVATE_KEY
  if (!raw) throw new Error('PROGRAM_AUTHORITY_PRIVATE_KEY not set')
  return Keypair.fromSecretKey(new Uint8Array(JSON.parse(raw)))
}

export const mintTestToken = action({
  args: {
    playerPublicKey: v.string(),
    amount: v.number(),
    decimals: v.optional(v.number()),
    tokenDir: v.string(),
    tokenName: v.string(),
    tokenSymbol: v.string(),
  },
  handler: async (_ctx, { playerPublicKey, amount, decimals = 6, tokenDir, tokenName, tokenSymbol }) => {
    const rpcEndpoint = process.env.SOLANA_RPC_ENDPOINT
    if (!rpcEndpoint) throw new Error('SOLANA_RPC_ENDPOINT not set')

    const authority = loadAuthority()
    const connection = new Connection(rpcEndpoint, 'confirmed')
    const playerPubkey = new PublicKey(playerPublicKey)
    const mintKeypair = Keypair.generate()
    const mintPubkey = mintKeypair.publicKey
    const metadataUri = `${BASE_URL}/tokens/${tokenDir}/metadata.json`

    // Tx 1: create mint with MetadataPointer extension only (no pre-allocated TokenMetadata space)
    // Token-2022 will auto-realloc the mint when we initialize the metadata in Tx 2.
    const mintLen = getMintLen([ExtensionType.MetadataPointer])
    const lamports = await connection.getMinimumBalanceForRentExemption(mintLen)

    const playerAta = getAssociatedTokenAddressSync(
      mintPubkey,
      playerPubkey,
      false,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    )

    const tx1 = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: authority.publicKey,
        newAccountPubkey: mintPubkey,
        space: mintLen,
        lamports,
        programId: TOKEN_2022_PROGRAM_ID,
      }),
      createInitializeMetadataPointerInstruction(
        mintPubkey,
        authority.publicKey,
        mintPubkey,
        TOKEN_2022_PROGRAM_ID
      ),
      createInitializeMintInstruction(
        mintPubkey,
        decimals,
        authority.publicKey,
        null,
        TOKEN_2022_PROGRAM_ID
      ),
      createAssociatedTokenAccountIdempotentInstruction(
        authority.publicKey,
        playerAta,
        playerPubkey,
        mintPubkey,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      ),
      createMintToInstruction(
        mintPubkey,
        playerAta,
        authority.publicKey,
        BigInt(amount) * BigInt(10 ** decimals),
        [],
        TOKEN_2022_PROGRAM_ID
      )
    )

    const sig1 = await sendAndConfirmTransaction(connection, tx1, [authority, mintKeypair])

    // Tx 2: initialize TokenMetadata — tokenMetadataInitializeWithRentTransfer
    // transfers extra lamports to the mint account then calls createInitializeInstruction,
    // which causes Token-2022 to realloc the mint account to fit the metadata TLV.
    await tokenMetadataInitializeWithRentTransfer(
      connection,
      authority,          // payer
      mintPubkey,         // mint
      authority.publicKey, // updateAuthority
      authority,          // mintAuthority (Signer)
      tokenName,
      tokenSymbol,
      metadataUri,
      [],                 // multiSigners
      { commitment: 'confirmed' },
      TOKEN_2022_PROGRAM_ID
    )

    return {
      success: true,
      signature: sig1,
      mintAddress: mintPubkey.toString(),
      amount,
      decimals,
      symbol: tokenSymbol,
    }
  },
})
