/**
 * One-time script: transfer ASTRDS mint authority from the Convex keypair to the VaultConfig PDA.
 * Must run AFTER anchor build + anchor deploy (so the new mint_astrds instruction exists on-chain).
 *
 * The Convex keypair (CNhWD1cXNaCMcjJmFcK25aFgV3ZTAFtyFDBvGfKZcpzF) holds the ASTRDS mint
 * authority and its private key is in PROGRAM_AUTHORITY_PRIVATE_KEY.
 * After this runs, minting can only happen through the on-chain mint_astrds instruction.
 *
 * Run: PROGRAM_AUTHORITY_PRIVATE_KEY='[...]' npx ts-node scripts/transferMintAuthority.ts
 */

import { web3 } from '@coral-xyz/anchor'
import {
  createSetAuthorityInstruction,
  AuthorityType,
  TOKEN_2022_PROGRAM_ID,
} from '@solana/spl-token'

const PROGRAM_ID = new web3.PublicKey('4bRZK8XfziVhLCgvtRdFJyTgN6tXGSPJT8xfbtt1AxBB')
const ASTRDS_MINT = new web3.PublicKey('5sqKSHDKZr4KbNzj972PSfmEhtR9eLeBvv1nBRbeQAnB')
const VAULT_CONFIG_SEED = Buffer.from('vault-config')

const [vaultConfigPda] = web3.PublicKey.findProgramAddressSync([VAULT_CONFIG_SEED], PROGRAM_ID)

async function main() {
  const raw = process.env.PROGRAM_AUTHORITY_PRIVATE_KEY
  if (!raw) throw new Error('PROGRAM_AUTHORITY_PRIVATE_KEY not set')
  const convexKeypair = web3.Keypair.fromSecretKey(new Uint8Array(JSON.parse(raw)))

  const connection = new web3.Connection('https://api.devnet.solana.com', 'confirmed')

  console.log('VaultConfig PDA:', vaultConfigPda.toBase58())
  console.log('Current authority (Convex keypair):', convexKeypair.publicKey.toBase58())
  console.log('Transferring ASTRDS mint authority...')

  const ix = createSetAuthorityInstruction(
    ASTRDS_MINT,
    convexKeypair.publicKey,
    AuthorityType.MintTokens,
    vaultConfigPda,
    [],
    TOKEN_2022_PROGRAM_ID
  )

  const tx = new web3.Transaction().add(ix)
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed')
  tx.feePayer = convexKeypair.publicKey
  tx.recentBlockhash = blockhash

  const sig = await connection.sendTransaction(tx, [convexKeypair])
  await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed')

  console.log('Done. Mint authority transferred to VaultConfig PDA.')
  console.log('Transaction:', sig)
}

main().catch((err) => { console.error(err); process.exit(1) })
