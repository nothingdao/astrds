// src/lib/designTokens.ts
// Theme-aware design tokens for canvas and legacy entity renderers.
//
// CSS variables in app/src/styles/style.css are the source of truth. Canvas cannot
// use Tailwind classes, so this module reads the relevant CSS vars, caches them,
// and exposes a stable object for render code. ThemeController refreshes the cache
// whenever the document theme changes.

export interface CanvasTokens {
  background: string;
  backgroundAlpha: string;
  shipStroke: string;
  shipFill: string;
  shipGlow: string;
  asteroidStroke: string;
  bulletDefault: string;
  pill: string;
  token: string;
  shipPickupFill: string;
  shipPickupStroke: string;
  shipPickupInner: string;
  shieldPowerup: string;
  rapidFirePowerup: string;
  particle: string;
  floatingText: string;
  spaceToken0: string;
  spaceToken1: string;
  spaceToken2: string;
  spaceToken3: string;
  spaceToken4: string;
  spaceToken5: string;
  spaceToken6: string;
  spaceToken7: string;
  spaceToken8: string;
  spaceToken9: string;
}

const FALLBACK_TOKENS: CanvasTokens = {
  background: "var(--canvas-background)",
  backgroundAlpha: "var(--canvas-background-alpha)",
  shipStroke: "var(--canvas-ship-stroke)",
  shipFill: "var(--canvas-ship-fill)",
  shipGlow: "var(--canvas-ship-glow)",
  asteroidStroke: "var(--canvas-asteroid-stroke)",
  bulletDefault: "var(--canvas-bullet)",
  pill: "var(--canvas-pill)",
  token: "var(--canvas-token)",
  shipPickupFill: "var(--canvas-ship-pickup-fill)",
  shipPickupStroke: "var(--canvas-ship-pickup-stroke)",
  shipPickupInner: "var(--canvas-ship-pickup-inner)",
  shieldPowerup: "var(--canvas-shield)",
  rapidFirePowerup: "var(--canvas-rapidfire)",
  particle: "var(--canvas-particle)",
  floatingText: "var(--canvas-floating-text)",
  spaceToken0: "var(--space-token-0)",
  spaceToken1: "var(--space-token-1)",
  spaceToken2: "var(--space-token-2)",
  spaceToken3: "var(--space-token-3)",
  spaceToken4: "var(--space-token-4)",
  spaceToken5: "var(--space-token-5)",
  spaceToken6: "var(--space-token-6)",
  spaceToken7: "var(--space-token-7)",
  spaceToken8: "var(--space-token-8)",
  spaceToken9: "var(--space-token-9)",
};

const VARS: Record<keyof CanvasTokens, string> = {
  background: "--canvas-background",
  backgroundAlpha: "--canvas-background-alpha",
  shipStroke: "--canvas-ship-stroke",
  shipFill: "--canvas-ship-fill",
  shipGlow: "--canvas-ship-glow",
  asteroidStroke: "--canvas-asteroid-stroke",
  bulletDefault: "--canvas-bullet",
  pill: "--canvas-pill",
  token: "--canvas-token",
  shipPickupFill: "--canvas-ship-pickup-fill",
  shipPickupStroke: "--canvas-ship-pickup-stroke",
  shipPickupInner: "--canvas-ship-pickup-inner",
  shieldPowerup: "--canvas-shield",
  rapidFirePowerup: "--canvas-rapidfire",
  particle: "--canvas-particle",
  floatingText: "--canvas-floating-text",
  spaceToken0: "--space-token-0",
  spaceToken1: "--space-token-1",
  spaceToken2: "--space-token-2",
  spaceToken3: "--space-token-3",
  spaceToken4: "--space-token-4",
  spaceToken5: "--space-token-5",
  spaceToken6: "--space-token-6",
  spaceToken7: "--space-token-7",
  spaceToken8: "--space-token-8",
  spaceToken9: "--space-token-9",
};

const readCssVar = (name: string, fallback: string): string => {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return value || fallback;
};

const readCanvasTokens = (): CanvasTokens => ({
  background: readCssVar(VARS.background, FALLBACK_TOKENS.background),
  backgroundAlpha: readCssVar(
    VARS.backgroundAlpha,
    FALLBACK_TOKENS.backgroundAlpha
  ),
  shipStroke: readCssVar(VARS.shipStroke, FALLBACK_TOKENS.shipStroke),
  shipFill: readCssVar(VARS.shipFill, FALLBACK_TOKENS.shipFill),
  shipGlow: readCssVar(VARS.shipGlow, FALLBACK_TOKENS.shipGlow),
  asteroidStroke: readCssVar(
    VARS.asteroidStroke,
    FALLBACK_TOKENS.asteroidStroke
  ),
  bulletDefault: readCssVar(VARS.bulletDefault, FALLBACK_TOKENS.bulletDefault),
  pill: readCssVar(VARS.pill, FALLBACK_TOKENS.pill),
  token: readCssVar(VARS.token, FALLBACK_TOKENS.token),
  shipPickupFill: readCssVar(
    VARS.shipPickupFill,
    FALLBACK_TOKENS.shipPickupFill
  ),
  shipPickupStroke: readCssVar(
    VARS.shipPickupStroke,
    FALLBACK_TOKENS.shipPickupStroke
  ),
  shipPickupInner: readCssVar(
    VARS.shipPickupInner,
    FALLBACK_TOKENS.shipPickupInner
  ),
  shieldPowerup: readCssVar(VARS.shieldPowerup, FALLBACK_TOKENS.shieldPowerup),
  rapidFirePowerup: readCssVar(
    VARS.rapidFirePowerup,
    FALLBACK_TOKENS.rapidFirePowerup
  ),
  particle: readCssVar(VARS.particle, FALLBACK_TOKENS.particle),
  floatingText: readCssVar(VARS.floatingText, FALLBACK_TOKENS.floatingText),
  spaceToken0: readCssVar(VARS.spaceToken0, FALLBACK_TOKENS.spaceToken0),
  spaceToken1: readCssVar(VARS.spaceToken1, FALLBACK_TOKENS.spaceToken1),
  spaceToken2: readCssVar(VARS.spaceToken2, FALLBACK_TOKENS.spaceToken2),
  spaceToken3: readCssVar(VARS.spaceToken3, FALLBACK_TOKENS.spaceToken3),
  spaceToken4: readCssVar(VARS.spaceToken4, FALLBACK_TOKENS.spaceToken4),
  spaceToken5: readCssVar(VARS.spaceToken5, FALLBACK_TOKENS.spaceToken5),
  spaceToken6: readCssVar(VARS.spaceToken6, FALLBACK_TOKENS.spaceToken6),
  spaceToken7: readCssVar(VARS.spaceToken7, FALLBACK_TOKENS.spaceToken7),
  spaceToken8: readCssVar(VARS.spaceToken8, FALLBACK_TOKENS.spaceToken8),
  spaceToken9: readCssVar(VARS.spaceToken9, FALLBACK_TOKENS.spaceToken9),
});

let tokenCache: CanvasTokens = { ...FALLBACK_TOKENS };

export const refreshDesignTokens = (): CanvasTokens => {
  tokenCache = readCanvasTokens();
  return tokenCache;
};

export const getCanvasTokens = (): CanvasTokens => tokenCache;

const PROTOCOL_COLOR_ALIASES: Record<string, keyof CanvasTokens> = {
  "#fff": "bulletDefault",
  "#ffffff": "bulletDefault",
  "#ff642d": "pill",
  "#4dc1f9": "shipGlow",
  "#34d399": "token",
  "#c084fc": "shieldPowerup",
  "#fbbf24": "rapidFirePowerup",
  "#a855f7": "spaceToken0",
  "#22d3ee": "spaceToken1",
  "#4ade80": "spaceToken2",
  "#f87171": "spaceToken4",
  "#f472b6": "spaceToken5",
  "#60a5fa": "spaceToken6",
  "#a3e635": "spaceToken7",
  "#e879f9": "spaceToken8",
  "#2dd4bf": "spaceToken9",
};

// Server/shared simulation snapshots still carry historical protocol colors.
// Resolve those protocol literals into current theme tokens at render time.
export const resolveCanvasColor = (color: string): string => {
  const tokenKey = PROTOCOL_COLOR_ALIASES[color.trim().toLowerCase()];
  return tokenKey ? tokenCache[tokenKey] : color;
};

if (typeof window !== "undefined") {
  queueMicrotask(() => refreshDesignTokens());
}
