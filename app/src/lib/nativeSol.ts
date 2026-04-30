export const NATIVE_SOL_MINT = "So11111111111111111111111111111111111111112";
export const NATIVE_SOL_PROGRAM_ID = "TOKEN" as const;
export const SOL_DECIMALS = 9;
export const SOL_RENT_AND_FEE_RESERVE_LAMPORTS = 0.01 * 1e9;

export const isNativeSolMint = (mintAddress?: string | null) =>
  mintAddress === NATIVE_SOL_MINT;

export const formatTokenAmount = (
  rawAmount: number,
  decimals: number,
  maximumFractionDigits = decimals
) =>
  (rawAmount / 10 ** decimals).toLocaleString(undefined, {
    maximumFractionDigits: Math.min(maximumFractionDigits, decimals),
  });
