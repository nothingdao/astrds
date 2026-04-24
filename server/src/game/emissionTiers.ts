import { Connection, PublicKey } from '@solana/web3.js'
import type { EmissionTier } from '../../../shared/game/protocol.js'

const ASTRDS_MINT = new PublicKey('5sqKSHDKZr4KbNzj972PSfmEhtR9eLeBvv1nBRbeQAnB')
const METEORA_DAMM_POOL = new PublicKey('EQPzzbREwvEkZeJ7bvcasrz3tAsADtGAJxzTtcxiTCQG')
const SOL_MINT = 'So11111111111111111111111111111111111111112'
const SOL_FALLBACK_USD = 150
const CACHE_TTL_MS = 60_000
const POOL_ACCOUNT_DISCRIMINATOR_SIZE = 8
const POOL_FEES_STRUCT_SIZE = 160
const PUBLIC_KEY_SIZE = 32
const TOKEN_A_MINT_OFFSET = POOL_ACCOUNT_DISCRIMINATOR_SIZE + POOL_FEES_STRUCT_SIZE
const TOKEN_B_MINT_OFFSET = TOKEN_A_MINT_OFFSET + PUBLIC_KEY_SIZE
const TOKEN_A_VAULT_OFFSET = TOKEN_B_MINT_OFFSET + PUBLIC_KEY_SIZE
const TOKEN_B_VAULT_OFFSET = TOKEN_A_VAULT_OFFSET + PUBLIC_KEY_SIZE

const FALLBACK_EMISSION_TIER: EmissionTier = {
  tier: 2,
  pillsPerGame: 10,
  astrdsPerPill: 5,
}

const EMISSION_TIERS: EmissionTier[] = [
  { tier: 1, pillsPerGame: 5, astrdsPerPill: 10 },
  { tier: 2, pillsPerGame: 10, astrdsPerPill: 5 },
  { tier: 3, pillsPerGame: 25, astrdsPerPill: 2 },
  { tier: 4, pillsPerGame: 50, astrdsPerPill: 1 },
  { tier: 5, pillsPerGame: 100, astrdsPerPill: 0.5 },
]

let connection: Connection | null = null
let cachedTier: { value: EmissionTier; fetchedAt: number } | null = null
let cachedSolUsd: { value: number; fetchedAt: number } | null = null

function getConnection(): Connection {
  if (!connection) {
    connection = new Connection(process.env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com', 'confirmed')
  }
  return connection
}

function readPublicKey(data: Uint8Array, offset: number): PublicKey {
  return new PublicKey(data.subarray(offset, offset + PUBLIC_KEY_SIZE))
}

function deriveEmissionTier(priceUsdPerAstrds: number): EmissionTier {
  if (priceUsdPerAstrds < 0.0024) return EMISSION_TIERS[0]
  if (priceUsdPerAstrds < 0.01) return EMISSION_TIERS[1]
  if (priceUsdPerAstrds < 0.05) return EMISSION_TIERS[2]
  if (priceUsdPerAstrds < 0.1) return EMISSION_TIERS[3]
  return EMISSION_TIERS[4]
}

async function fetchSolPriceUsd(): Promise<number> {
  const now = Date.now()
  if (cachedSolUsd && now - cachedSolUsd.fetchedAt < CACHE_TTL_MS) {
    return cachedSolUsd.value
  }

  try {
    const response = await fetch(`https://api.jup.ag/price/v2?ids=${SOL_MINT}`)
    const json = await response.json()
    const price = Number(json?.data?.[SOL_MINT]?.price)
    if (Number.isFinite(price) && price > 0) {
      cachedSolUsd = { value: price, fetchedAt: now }
      return price
    }
  } catch {
    // Fall through to cached/fallback value.
  }

  const fallback = cachedSolUsd?.value ?? SOL_FALLBACK_USD
  cachedSolUsd = { value: fallback, fetchedAt: now }
  return fallback
}

async function getVaultUiAmount(vault: PublicKey): Promise<number> {
  const balance = await getConnection().getTokenAccountBalance(vault, 'confirmed')
  return balance.value.uiAmount ?? 0
}

async function fetchTierUncached(): Promise<EmissionTier> {
  const accountInfo = await getConnection().getAccountInfo(METEORA_DAMM_POOL, 'confirmed')
  if (!accountInfo) {
    throw new Error('Meteora DAMM v2 pool account not found on devnet')
  }

  const data = new Uint8Array(accountInfo.data)
  const tokenAMint = readPublicKey(data, TOKEN_A_MINT_OFFSET)
  const tokenBMint = readPublicKey(data, TOKEN_B_MINT_OFFSET)
  const tokenAVault = readPublicKey(data, TOKEN_A_VAULT_OFFSET)
  const tokenBVault = readPublicKey(data, TOKEN_B_VAULT_OFFSET)

  const [solUsdPrice, tokenAReserve, tokenBReserve] = await Promise.all([
    fetchSolPriceUsd(),
    getVaultUiAmount(tokenAVault),
    getVaultUiAmount(tokenBVault),
  ])

  const astrdsIsTokenA = tokenAMint.equals(ASTRDS_MINT)
  const astrdsReserve = astrdsIsTokenA ? tokenAReserve : tokenBReserve
  const solReserve = astrdsIsTokenA ? tokenBReserve : tokenAReserve

  if (!astrdsIsTokenA && !tokenBMint.equals(ASTRDS_MINT)) {
    throw new Error('ASTRDS mint not found in Meteora DAMM v2 pool')
  }

  if (astrdsReserve <= 0) {
    throw new Error('ASTRDS reserve is empty in the Meteora DAMM v2 pool')
  }

  const priceSolPerAstrds = solReserve / astrdsReserve
  const priceUsdPerAstrds = priceSolPerAstrds * solUsdPrice

  return deriveEmissionTier(priceUsdPerAstrds)
}

export async function fetchEmissionTier(): Promise<EmissionTier> {
  const now = Date.now()
  if (cachedTier && now - cachedTier.fetchedAt < CACHE_TTL_MS) {
    return cachedTier.value
  }

  const tier = await fetchTierUncached()
  cachedTier = { value: tier, fetchedAt: now }
  return tier
}

export { FALLBACK_EMISSION_TIER }
