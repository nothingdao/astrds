import { Connection, PublicKey } from "@solana/web3.js";
import type { EmissionTier } from "../../../shared/game/protocol.js";
import type { GameConfig } from "./gameConfig.js";
import { DEFAULT_GAME_CONFIG } from "./gameConfig.js";

const ASTRDS_MINT = new PublicKey(
  "5sqKSHDKZr4KbNzj972PSfmEhtR9eLeBvv1nBRbeQAnB"
);
const METEORA_DAMM_POOL = new PublicKey(
  "EQPzzbREwvEkZeJ7bvcasrz3tAsADtGAJxzTtcxiTCQG"
);
const SOL_FALLBACK_USD = 150;
const CACHE_TTL_MS = 60_000;
const POOL_ACCOUNT_DISCRIMINATOR_SIZE = 8;
const POOL_FEES_STRUCT_SIZE = 160;
const PUBLIC_KEY_SIZE = 32;
const TOKEN_A_MINT_OFFSET =
  POOL_ACCOUNT_DISCRIMINATOR_SIZE + POOL_FEES_STRUCT_SIZE;
const TOKEN_B_MINT_OFFSET = TOKEN_A_MINT_OFFSET + PUBLIC_KEY_SIZE;
const TOKEN_A_VAULT_OFFSET = TOKEN_B_MINT_OFFSET + PUBLIC_KEY_SIZE;
const TOKEN_B_VAULT_OFFSET = TOKEN_A_VAULT_OFFSET + PUBLIC_KEY_SIZE;

let connection: Connection | null = null;
let cachedTier: { value: EmissionTier; fetchedAt: number } | null = null;
let cachedSolUsd: { value: number; fetchedAt: number } | null = null;

function getConnection(): Connection {
  if (!connection) {
    connection = new Connection(
      process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com",
      "confirmed"
    );
  }
  return connection;
}

function readPublicKey(data: Uint8Array, offset: number): PublicKey {
  return new PublicKey(data.subarray(offset, offset + PUBLIC_KEY_SIZE));
}

function deriveEmissionTier(
  priceUsdPerAstrds: number,
  config: GameConfig
): EmissionTier {
  const bp = config.tierBreakpointsUsd;
  const pills = config.pillsPerTier;
  const astrds = config.astrdsPerPill;

  // Tier index: 0-4 based on breakpoints
  let idx = 0;
  for (let i = 0; i < bp.length; i++) {
    if (priceUsdPerAstrds >= bp[i]) idx = i + 1;
  }

  return {
    tier: (idx + 1) as 1 | 2 | 3 | 4 | 5,
    pillsPerGame: pills[idx],
    astrdsPerPill: astrds[idx],
  };
}

async function fetchSolPriceUsd(): Promise<number> {
  const now = Date.now();
  if (cachedSolUsd && now - cachedSolUsd.fetchedAt < CACHE_TTL_MS) {
    return cachedSolUsd.value;
  }

  try {
    const convexUrl =
      process.env.CONVEX_SITE_URL ??
      process.env.CONVEX_URL?.replace(".convex.cloud", ".convex.site");
    if (convexUrl) {
      const response = await fetch(`${convexUrl}/prices/sol-usd`);
      if (!response.ok)
        throw new Error(`Convex price endpoint returned ${response.status}`);
      const json = await response.json();
      const price = Number(json?.priceUsd);
      if (Number.isFinite(price) && price > 0) {
        cachedSolUsd = { value: price, fetchedAt: now };
        return price;
      }
    }
  } catch {
    // Fall through to cached/fallback value.
  }

  const fallback = cachedSolUsd?.value ?? SOL_FALLBACK_USD;
  cachedSolUsd = { value: fallback, fetchedAt: now };
  return fallback;
}

async function getVaultUiAmount(vault: PublicKey): Promise<number> {
  const balance = await getConnection().getTokenAccountBalance(
    vault,
    "confirmed"
  );
  return balance.value.uiAmount ?? 0;
}

async function fetchTierUncached(config: GameConfig): Promise<EmissionTier> {
  const accountInfo = await getConnection().getAccountInfo(
    METEORA_DAMM_POOL,
    "confirmed"
  );
  if (!accountInfo) {
    throw new Error("Meteora DAMM v2 pool account not found on devnet");
  }

  const data = new Uint8Array(accountInfo.data);
  const tokenAMint = readPublicKey(data, TOKEN_A_MINT_OFFSET);
  const tokenBMint = readPublicKey(data, TOKEN_B_MINT_OFFSET);
  const tokenAVault = readPublicKey(data, TOKEN_A_VAULT_OFFSET);
  const tokenBVault = readPublicKey(data, TOKEN_B_VAULT_OFFSET);

  const [solUsdPrice, tokenAReserve, tokenBReserve] = await Promise.all([
    fetchSolPriceUsd(),
    getVaultUiAmount(tokenAVault),
    getVaultUiAmount(tokenBVault),
  ]);

  const astrdsIsTokenA = tokenAMint.equals(ASTRDS_MINT);
  const astrdsReserve = astrdsIsTokenA ? tokenAReserve : tokenBReserve;
  const solReserve = astrdsIsTokenA ? tokenBReserve : tokenAReserve;

  if (!astrdsIsTokenA && !tokenBMint.equals(ASTRDS_MINT)) {
    throw new Error("ASTRDS mint not found in Meteora DAMM v2 pool");
  }

  if (astrdsReserve <= 0) {
    throw new Error("ASTRDS reserve is empty in the Meteora DAMM v2 pool");
  }

  const priceSolPerAstrds = solReserve / astrdsReserve;
  const priceUsdPerAstrds = priceSolPerAstrds * solUsdPrice;

  return deriveEmissionTier(priceUsdPerAstrds, config);
}

export async function fetchEmissionTier(
  config: GameConfig = DEFAULT_GAME_CONFIG
): Promise<EmissionTier> {
  const now = Date.now();
  if (cachedTier && now - cachedTier.fetchedAt < CACHE_TTL_MS) {
    return cachedTier.value;
  }

  const tier = await fetchTierUncached(config);
  cachedTier = { value: tier, fetchedAt: now };
  return tier;
}

export function getFallbackEmissionTier(
  config: GameConfig = DEFAULT_GAME_CONFIG
): EmissionTier {
  // Default to tier 2 (middle of the road)
  return {
    tier: 2,
    pillsPerGame: config.pillsPerTier[1] ?? 10,
    astrdsPerPill: config.astrdsPerPill[1] ?? 5,
  };
}
