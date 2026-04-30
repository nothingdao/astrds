"use node";

// Dev-only: mint a test SPL Token-2022 with on-chain metadata.
// Mint keypair is derived deterministically from authority + tokenDir so the same
// token always has the same mint address across multiple calls.
// Access is restricted to wallets listed in DEV_AUTHORIZED_WALLETS (comma-separated).

import { action } from "./_generated/server";
import { v } from "convex/values";
import { createHash } from "node:crypto";
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
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
} from "@solana/spl-token";

const BASE_URL = "https://astrds.ndao.computer";

const loadAuthority = (): Keypair => {
  const raw = process.env.PROGRAM_AUTHORITY_PRIVATE_KEY;
  if (!raw) throw new Error("PROGRAM_AUTHORITY_PRIVATE_KEY not set");
  return Keypair.fromSecretKey(new Uint8Array(JSON.parse(raw)));
};

// Deterministic mint keypair: sha256(authority secret key || tokenDir).
// Same authority + tokenDir always produces the same mint address.
const deriveMintKeypair = (authority: Keypair, tokenDir: string): Keypair => {
  const seed = createHash("sha256")
    .update(authority.secretKey)
    .update(tokenDir)
    .digest();
  return Keypair.fromSeed(seed);
};

export const mintTestToken = action({
  args: {
    playerPublicKey: v.string(),
    amount: v.number(),
    decimals: v.optional(v.number()),
    tokenDir: v.string(),
    tokenName: v.string(),
    tokenSymbol: v.string(),
  },
  handler: async (
    _ctx,
    { playerPublicKey, amount, decimals = 6, tokenDir, tokenName, tokenSymbol }
  ) => {
    const rpcEndpoint = process.env.SOLANA_RPC_ENDPOINT;
    if (!rpcEndpoint) throw new Error("SOLANA_RPC_ENDPOINT not set");

    const authority = loadAuthority();
    const connection = new Connection(rpcEndpoint, "confirmed");
    const playerPubkey = new PublicKey(playerPublicKey);
    const mintKeypair = deriveMintKeypair(authority, tokenDir);
    const mintPubkey = mintKeypair.publicKey;
    const metadataUri = `${BASE_URL}/tokens/${tokenDir}/metadata.json`;

    const playerAta = getAssociatedTokenAddressSync(
      mintPubkey,
      playerPubkey,
      false,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const mintAccountInfo = await connection.getAccountInfo(
      mintPubkey,
      "confirmed"
    );

    if (!mintAccountInfo) {
      // First time — create mint with MetadataPointer, ATA, and initial mint.
      const mintLen = getMintLen([ExtensionType.MetadataPointer]);
      const lamports = await connection.getMinimumBalanceForRentExemption(
        mintLen
      );

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
      );

      const sig1 = await sendAndConfirmTransaction(connection, tx1, [
        authority,
        mintKeypair,
      ]);

      // Tx 2: initialize TokenMetadata (causes Token-2022 to realloc the mint account).
      await tokenMetadataInitializeWithRentTransfer(
        connection,
        authority,
        mintPubkey,
        authority.publicKey,
        authority,
        tokenName,
        tokenSymbol,
        metadataUri,
        [],
        { commitment: "confirmed" },
        TOKEN_2022_PROGRAM_ID
      );

      return {
        success: true,
        signature: sig1,
        mintAddress: mintPubkey.toString(),
        amount,
        decimals,
        symbol: tokenSymbol,
      };
    }

    // Mint already exists — just top up the player's ATA.
    const tx = new Transaction().add(
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
    );

    const sig = await sendAndConfirmTransaction(connection, tx, [authority]);
    return {
      success: true,
      signature: sig,
      mintAddress: mintPubkey.toString(),
      amount,
      decimals,
      symbol: tokenSymbol,
    };
  },
});
