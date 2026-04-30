import { PublicKey } from "@solana/web3.js";
import { connection } from "@/lib/solana";
import { convex } from "@/lib/convex";
import { api } from "../../convex/_generated/api";

export const ASTRDS_MINT = new PublicKey(
  "5sqKSHDKZr4KbNzj972PSfmEhtR9eLeBvv1nBRbeQAnB"
);
export const METEORA_DAMM_POOL = new PublicKey(
  "EQPzzbREwvEkZeJ7bvcasrz3tAsADtGAJxzTtcxiTCQG"
);
export const TOTAL_GAMES_CAP = 420_000;
export const TOTAL_ASTRDS_SUPPLY_CAP = 21_000_000;
export const BURNED_ASTRDS_STUB = 0;

const SOL_PRICE_CACHE_TTL_MS = 60_000;
const POOL_ACCOUNT_DISCRIMINATOR_SIZE = 8;
const POOL_FEES_STRUCT_SIZE = 160;
const PUBLIC_KEY_SIZE = 32;

const TOKEN_A_MINT_OFFSET =
  POOL_ACCOUNT_DISCRIMINATOR_SIZE + POOL_FEES_STRUCT_SIZE;
const TOKEN_B_MINT_OFFSET = TOKEN_A_MINT_OFFSET + PUBLIC_KEY_SIZE;
const TOKEN_A_VAULT_OFFSET = TOKEN_B_MINT_OFFSET + PUBLIC_KEY_SIZE;
const TOKEN_B_VAULT_OFFSET = TOKEN_A_VAULT_OFFSET + PUBLIC_KEY_SIZE;

let solPriceCache: { usd: number; fetchedAt: number } | null = null;

export interface EmissionTier {
  tier: 1 | 2 | 3 | 4 | 5;
  pillsPerGame: number;
  astrdsPerPill: number;
  minUsd: number;
  maxUsd: number | null;
}

export interface MeteoraPoolSnapshot {
  poolAddress: string;
  tokenAMint: string;
  tokenBMint: string;
  tokenAVault: string;
  tokenBVault: string;
  astrdsReserve: number;
  solReserve: number;
  priceSolPerAstrds: number;
  priceUsdPerAstrds: number;
  solUsdPrice: number;
}

const EMISSION_TIERS: EmissionTier[] = [
  { tier: 1, minUsd: 0, maxUsd: 0.0024, pillsPerGame: 5, astrdsPerPill: 10 },
  { tier: 2, minUsd: 0.0024, maxUsd: 0.01, pillsPerGame: 10, astrdsPerPill: 5 },
  { tier: 3, minUsd: 0.01, maxUsd: 0.05, pillsPerGame: 25, astrdsPerPill: 2 },
  { tier: 4, minUsd: 0.05, maxUsd: 0.1, pillsPerGame: 50, astrdsPerPill: 1 },
  { tier: 5, minUsd: 0.1, maxUsd: null, pillsPerGame: 100, astrdsPerPill: 0.5 },
];

function readPublicKey(data: Uint8Array, offset: number): PublicKey {
  return new PublicKey(data.subarray(offset, offset + PUBLIC_KEY_SIZE));
}

async function fetchSolPriceUsd(): Promise<number> {
  const now = Date.now();
  if (solPriceCache && now - solPriceCache.fetchedAt < SOL_PRICE_CACHE_TTL_MS) {
    return solPriceCache.usd;
  }

  const result = await convex.action(api.prices.getSolUsdPrice, {
    maxAgeMs: SOL_PRICE_CACHE_TTL_MS,
  });
  const price = Number(result.priceUsd);
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error("Unable to fetch a valid SOL/USD price");
  }

  solPriceCache = { usd: price, fetchedAt: now };
  return price;
}

async function getVaultUiAmount(vault: PublicKey): Promise<number> {
  const balance = await connection.getTokenAccountBalance(vault, "confirmed");
  return balance.value.uiAmount ?? 0;
}

export async function fetchMeteoraPoolSnapshot(): Promise<MeteoraPoolSnapshot> {
  const accountInfo = await connection.getAccountInfo(
    METEORA_DAMM_POOL,
    "confirmed"
  );
  if (!accountInfo) {
    throw new Error("Meteora DAMM v2 pool account not found on devnet");
  }

  const data = new Uint8Array(accountInfo.data as unknown as ArrayBuffer);
  const tokenAMint = readPublicKey(data, TOKEN_A_MINT_OFFSET);
  const tokenBMint = readPublicKey(data, TOKEN_B_MINT_OFFSET);
  const tokenAVault = readPublicKey(data, TOKEN_A_VAULT_OFFSET);
  const tokenBVault = readPublicKey(data, TOKEN_B_VAULT_OFFSET);

  const solUsdPrice = await fetchSolPriceUsd();

  const [tokenAReserve, tokenBReserve] = await Promise.all([
    getVaultUiAmount(tokenAVault),
    getVaultUiAmount(tokenBVault),
  ]);

  const astrdsIsTokenA = tokenAMint.equals(ASTRDS_MINT);
  const astrdsReserve = astrdsIsTokenA ? tokenAReserve : tokenBReserve;
  const solReserve = astrdsIsTokenA ? tokenBReserve : tokenAReserve;

  if (astrdsReserve <= 0) {
    throw new Error("ASTRDS reserve is empty in the Meteora pool");
  }

  const priceSolPerAstrds = solReserve / astrdsReserve;
  const priceUsdPerAstrds = priceSolPerAstrds * solUsdPrice;

  return {
    poolAddress: METEORA_DAMM_POOL.toBase58(),
    tokenAMint: tokenAMint.toBase58(),
    tokenBMint: tokenBMint.toBase58(),
    tokenAVault: tokenAVault.toBase58(),
    tokenBVault: tokenBVault.toBase58(),
    astrdsReserve,
    solReserve,
    priceSolPerAstrds,
    priceUsdPerAstrds,
    solUsdPrice,
  };
}

export function getEmissionTier(priceUsdPerAstrds: number): EmissionTier {
  if (priceUsdPerAstrds < 0.0024) return EMISSION_TIERS[0];
  if (priceUsdPerAstrds <= 0.01) return EMISSION_TIERS[1];
  if (priceUsdPerAstrds <= 0.05) return EMISSION_TIERS[2];
  if (priceUsdPerAstrds <= 0.1) return EMISSION_TIERS[3];
  return EMISSION_TIERS[4];
}
