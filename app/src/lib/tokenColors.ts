// Deterministic color assignment for space tokens.
// Same mint address always maps to the same color, avoiding orange (#FF642D)
// which is reserved for standard ASTRDS tokens.

const SPACE_TOKEN_PALETTE = [
  '#a855f7', // purple
  '#22d3ee', // cyan
  '#4ade80', // green
  '#fbbf24', // yellow
  '#f87171', // red/coral
  '#f472b6', // pink
  '#60a5fa', // blue
  '#a3e635', // lime
  '#e879f9', // fuchsia
  '#2dd4bf', // teal
]

export const ASTRDS_COLOR = '#FF642D' // orange — standard in-game token

export function getTokenColor(mintAddress: string): string {
  let hash = 0
  for (let i = 0; i < mintAddress.length; i++) {
    hash = (hash * 31 + mintAddress.charCodeAt(i)) & 0xffffffff
  }
  return SPACE_TOKEN_PALETTE[Math.abs(hash) % SPACE_TOKEN_PALETTE.length]
}
