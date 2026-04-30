import { action, httpAction } from "./_generated/server";
import { v } from "convex/values";

const CACHE_TTL_MS = 60_000;
const MAX_REASONABLE_SOL_USD = 1_000;
const MIN_REASONABLE_SOL_USD = 1;

type PriceResult = {
  priceUsd: number;
  provider: string;
  fetchedAt: number;
};

let cached: PriceResult | null = null;

const parsePrice = (value: unknown): number | null => {
  const price =
    typeof value === "number"
      ? value
      : typeof value === "string"
      ? Number(value)
      : NaN;
  if (!Number.isFinite(price)) return null;
  if (price < MIN_REASONABLE_SOL_USD || price > MAX_REASONABLE_SOL_USD)
    return null;
  return price;
};

const fetchJson = async (url: string, init?: RequestInit) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        accept: "application/json",
        "user-agent": "ASTRDS/1.0",
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
};

const providers: Array<() => Promise<PriceResult>> = [
  async () => {
    const json = await fetchJson(
      "https://api.coinbase.com/v2/prices/SOL-USD/spot"
    );
    const price = parsePrice(json?.data?.amount);
    if (!price) throw new Error("Coinbase returned invalid SOL price");
    return { priceUsd: price, provider: "coinbase", fetchedAt: Date.now() };
  },
  async () => {
    const json = await fetchJson(
      "https://api.binance.com/api/v3/ticker/price?symbol=SOLUSDT"
    );
    const price = parsePrice(json?.price);
    if (!price) throw new Error("Binance returned invalid SOL price");
    return { priceUsd: price, provider: "binance", fetchedAt: Date.now() };
  },
  async () => {
    const json = await fetchJson(
      "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd"
    );
    const price = parsePrice(json?.solana?.usd);
    if (!price) throw new Error("CoinGecko returned invalid SOL price");
    return { priceUsd: price, provider: "coingecko", fetchedAt: Date.now() };
  },
];

const getCachedSolUsdPrice = async (
  maxAgeMs = CACHE_TTL_MS
): Promise<PriceResult> => {
  const now = Date.now();
  if (cached && now - cached.fetchedAt < maxAgeMs) {
    return { ...cached, provider: `${cached.provider}:cache` };
  }

  const errors: string[] = [];
  for (const provider of providers) {
    try {
      const result = await provider();
      cached = result;
      return result;
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  if (cached) {
    return { ...cached, provider: `${cached.provider}:stale` };
  }

  throw new Error(
    `Unable to fetch SOL/USD from all providers: ${errors.join(" | ")}`
  );
};

export const getSolUsdPrice = action({
  args: {
    maxAgeMs: v.optional(v.number()),
  },
  handler: async (_ctx, args): Promise<PriceResult> =>
    getCachedSolUsdPrice(args.maxAgeMs ?? CACHE_TTL_MS),
});

export const solUsdPriceHttp = httpAction(async () => {
  try {
    const result = await getCachedSolUsdPrice(CACHE_TTL_MS);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      err instanceof Error ? err.message : "Unable to fetch SOL/USD price",
      { status: 503 }
    );
  }
});
