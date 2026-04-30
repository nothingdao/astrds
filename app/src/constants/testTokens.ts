// Test tokens for dev environment — hosted at astrds.ndao.computer/tokens/[dir]/

export interface TestTokenDef {
  dir: string;
  name: string;
  symbol: string;
  description: string;
  decimals: number;
}

export const TEST_TOKENS: TestTokenDef[] = [
  {
    dir: "cope",
    name: "Copium",
    symbol: "COPE",
    description:
      "It's not a loss until you sell. I am not selling. Portfolio down 98.7%. This is accumulation.",
    decimals: 6,
  },
  {
    dir: "ngmi",
    name: "Not Gonna Make It",
    symbol: "NGMI",
    description:
      "Sold ETH at $200 to buy a gaming chair. Sold SOL at $3. This is my token now.",
    decimals: 6,
  },
  {
    dir: "worm",
    name: "Brain Worm",
    symbol: "WORM",
    description:
      "The brain worm told me to buy this. The brain worm is never wrong. The brain worm lives in me now.",
    decimals: 6,
  },
  {
    dir: "rugd",
    name: "Rugged",
    symbol: "RUGD",
    description:
      "Dev doxxed, liquidity locked, audit passed. Rugged anyway. How? Nobody knows. Floor is zero.",
    decimals: 6,
  },
  {
    dir: "smol",
    name: "Smol Brain",
    symbol: "SMOL",
    description:
      "My brain is smol. My bags are smol. My gains are smol. Everything is smol. I am smol.",
    decimals: 6,
  },
  {
    dir: "shill",
    name: "Shill Token",
    symbol: "SHILL",
    description:
      "Have you heard about this hidden gem? My uncle works at Solana and said this is the next 1000x. NFA DYOR.",
    decimals: 6,
  },
  {
    dir: "rekt",
    name: "Rekt Finance",
    symbol: "REKT",
    description:
      "It is not a loss until you sell. I am not selling. Portfolio down 98.7%. This is accumulation.",
    decimals: 6,
  },
  {
    dir: "degen",
    name: "Pure Degen",
    symbol: "DEGEN",
    description:
      "Aped my life savings into this at 3am. No research. No sleep. Just vibes and a 100x dream.",
    decimals: 6,
  },
  {
    dir: "pprhn",
    name: "Paper Hands",
    symbol: "PPRHN",
    description:
      "Sold the bottom. Bought the top. Did it twice in the same week. My hands are origami.",
    decimals: 6,
  },
  {
    dir: "gbrain",
    name: "Gigabrain",
    symbol: "GBRAIN",
    description:
      "While others see a rug, I see a 4D chess move by the devs. I am never wrong, I am just early.",
    decimals: 6,
  },
];

export const BASE_URL = "https://astrds.ndao.computer";

export function getTokenMetadataUri(dir: string): string {
  return `${BASE_URL}/tokens/${dir}/metadata.json`;
}

export function getTokenLogoUri(dir: string): string {
  return `${BASE_URL}/tokens/${dir}/logo.svg`;
}
