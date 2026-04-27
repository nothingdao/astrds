import * as anchor from '@coral-xyz/anchor'
import { web3 } from '@coral-xyz/anchor'
import { readFileSync } from 'fs'
import { homedir } from 'os'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const METEORA_POOL = new web3.PublicKey('EQPzzbREwvEkZeJ7bvcasrz3tAsADtGAJxzTtcxiTCQG')
const PROGRAM_ID = new web3.PublicKey('4bRZK8XfziVhLCgvtRdFJyTgN6tXGSPJT8xfbtt1AxBB')
const RPC = 'https://api.devnet.solana.com'

async function main() {
  const kpBytes = JSON.parse(readFileSync(join(homedir(), '.config/solana/id.json'), 'utf8'))
  const authority = web3.Keypair.fromSecretKey(Uint8Array.from(kpBytes))
  const connection = new web3.Connection(RPC, 'confirmed')
  const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(authority), {
    commitment: 'confirmed',
  })

  const idl = JSON.parse(
    readFileSync(join(__dirname, '../target/idl/space_vault_program.json'), 'utf8')
  )
  const program = new anchor.Program(idl, provider)

  const [vaultConfig] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from('vault-config')],
    PROGRAM_ID
  )

  const before = await program.account.vaultConfig.fetch(vaultConfig)
  console.log('meteoraPool before:', (before as any).meteoraPool.toBase58())

  const tx = await program.methods
    .setMeteoraPool(METEORA_POOL)
    .accounts({ authority: authority.publicKey, vaultConfig })
    .rpc()

  console.log('setMeteoraPool tx:', tx)

  const after = await program.account.vaultConfig.fetch(vaultConfig)
  console.log('meteoraPool after: ', (after as any).meteoraPool.toBase58())
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
