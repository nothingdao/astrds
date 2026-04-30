// src/utils/tokenBalances.ts
import { PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { connection } from "@/lib/solana";

async function getParsedAccountsForProgram(
  walletPubkey: PublicKey,
  programId: PublicKey
) {
  try {
    const result = await connection.getParsedTokenAccountsByOwner(
      walletPubkey,
      { programId }
    );
    return result.value;
  } catch {
    return [];
  }
}

export async function getTokenBalances(
  walletAddress: string,
  tokenMints: string[]
) {
  try {
    const walletPubkey = new PublicKey(walletAddress);

    // Query both legacy and Token-2022 accounts
    const [legacyAccounts, token2022Accounts] = await Promise.all([
      getParsedAccountsForProgram(walletPubkey, TOKEN_PROGRAM_ID),
      getParsedAccountsForProgram(walletPubkey, TOKEN_2022_PROGRAM_ID),
    ]);

    const allAccounts = [...legacyAccounts, ...token2022Accounts];
    const balances: Record<string, number> = {};

    tokenMints.forEach((mint) => {
      balances[mint] = 0;
    });

    allAccounts.forEach((account) => {
      const parsedInfo = account.account.data.parsed.info;
      const mintAddress = parsedInfo.mint;
      if (tokenMints.includes(mintAddress)) {
        balances[mintAddress] =
          Number(parsedInfo.tokenAmount.amount) /
          Math.pow(10, parsedInfo.tokenAmount.decimals);
      }
    });

    const solBalance = await connection.getBalance(walletPubkey);
    balances.SOL = solBalance / 1e9;

    return balances;
  } catch (error) {
    console.error("Error fetching token balances:", error);
    return {
      SOL: 0,
      ...tokenMints.reduce((acc, mint) => ({ ...acc, [mint]: 0 }), {}),
    };
  }
}

export async function verifyTokenBalance(
  walletAddress: string,
  tokenType: string,
  requiredAmount: number
) {
  try {
    const walletPubkey = new PublicKey(walletAddress);

    if (tokenType === "SOL") {
      const balance = await connection.getBalance(walletPubkey);
      return balance / 1e9 >= requiredAmount;
    }

    const [legacyAccounts, token2022Accounts] = await Promise.all([
      getParsedAccountsForProgram(walletPubkey, TOKEN_PROGRAM_ID),
      getParsedAccountsForProgram(walletPubkey, TOKEN_2022_PROGRAM_ID),
    ]);

    const account = [...legacyAccounts, ...token2022Accounts].find(
      (a) => a.account.data.parsed.info.mint === tokenType
    );

    if (!account) return false;

    const balance =
      Number(account.account.data.parsed.info.tokenAmount.amount) /
      Math.pow(10, account.account.data.parsed.info.tokenAmount.decimals);

    return balance >= requiredAmount;
  } catch (error) {
    console.error("Error verifying token balance:", error);
    throw error;
  }
}
