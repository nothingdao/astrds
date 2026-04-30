// Known developer/operator wallet addresses.
// These wallets get direct access to the Admin overlay without an API key.
// Add any dev wallets here — this is client-side only (display gate).
// The Convex mutation also validates against this list server-side.
export const DEV_WALLETS = new Set([
  "jrXCZwP8bxDnGs7ChD4F77We1K4J89R53SAVk5HsSoE", // deployer / upgrade authority
  "FEb3tauuDVbcErhewnDCFeM2Lt6ddRMwme23UY3ANebg", // astrds player 1
]);

export const isDevWallet = (address: string | undefined): boolean =>
  !!address && DEV_WALLETS.has(address);
