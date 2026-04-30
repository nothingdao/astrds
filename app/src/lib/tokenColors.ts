// Deterministic color assignment for space tokens.
// CSS variables in style.css are the source of truth so token colors can adapt
// between light/dark themes while staying stable per mint address.

const SPACE_TOKEN_VAR_COUNT = 10;

// Historical protocol/server palette. Keep this only for matching snapshots from
// the game server, which cannot know the client's active CSS theme.
const SPACE_TOKEN_PROTOCOL_PALETTE = [
  "#a855f7",
  "#22d3ee",
  "#4ade80",
  "#fbbf24",
  "#f87171",
  "#f472b6",
  "#60a5fa",
  "#a3e635",
  "#e879f9",
  "#2dd4bf",
];

const readCssVar = (name: string): string => {
  if (typeof window === "undefined") return `var(${name})`;
  return (
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() ||
    `var(${name})`
  );
};

const getTokenIndex = (mintAddress: string): number => {
  let hash = 0;
  for (let i = 0; i < mintAddress.length; i++) {
    hash = (hash * 31 + mintAddress.charCodeAt(i)) & 0xffffffff;
  }
  return Math.abs(hash) % SPACE_TOKEN_VAR_COUNT;
};

export const getAstrdsColor = (): string => readCssVar("--canvas-pill");

export function getTokenColor(mintAddress: string): string {
  return readCssVar(`--space-token-${getTokenIndex(mintAddress)}`);
}

export function getTokenProtocolColor(mintAddress: string): string {
  return SPACE_TOKEN_PROTOCOL_PALETTE[getTokenIndex(mintAddress)];
}
