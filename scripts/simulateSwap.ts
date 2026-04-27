import { readFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { Connection, Keypair } from '../app/node_modules/@solana/web3.js'
import { buildMeteoraSwapTransaction } from '../app/src/lib/spaceVault'

async function main() {
  const direction = (process.argv[2] || 'buy') as 'buy' | 'sell'
  const amount = BigInt(process.argv[3] || (direction === 'buy' ? '100000' : '1000000'))
  const kpBytes = JSON.parse(readFileSync(join(homedir(), '.config/solana/id.json'), 'utf8'))
  const user = Keypair.fromSecretKey(Uint8Array.from(kpBytes))
  const connection = new Connection(process.env.SOLANA_RPC_ENDPOINT || 'https://api.devnet.solana.com', 'confirmed')
  const built = await buildMeteoraSwapTransaction({ connection, user: user.publicKey, direction, rawAmountIn: amount })
  built.transaction.sign(user)
  const sim = await connection.simulateTransaction(built.transaction)
  console.log(JSON.stringify(sim.value, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
