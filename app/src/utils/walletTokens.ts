// src/utils/walletTokens.ts
// Fetch all SPL token accounts for a wallet + enrich with Helius DAS metadata

import { Connection, PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { RPC_ENDPOINT } from "@/lib/solana";
import {
  NATIVE_SOL_MINT,
  SOL_DECIMALS,
  SOL_RENT_AND_FEE_RESERVE_LAMPORTS,
} from "@/lib/nativeSol";

export interface WalletToken {
  accountAddress: string; // the ATA pubkey
  mintAddress: string;
  programId: "TOKEN" | "TOKEN_2022";
  balance: number; // raw amount (no decimals applied)
  decimals: number;
  uiBalance: number; // balance / 10^decimals
  symbol: string;
  name: string;
  logoUri?: string;
}

const HELIUS_API_KEY = import.meta.env.VITE_HELIUS_API_KEY as string;
const HELIUS_DAS_URL = `https://devnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

async function fetchDasMetadata(
  mintAddresses: string[]
): Promise<Map<string, { symbol: string; name: string; logoUri?: string }>> {
  const result = new Map<
    string,
    { symbol: string; name: string; logoUri?: string }
  >();
  if (!mintAddresses.length || !HELIUS_API_KEY) return result;

  try {
    const res = await fetch(HELIUS_DAS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "get-assets",
        method: "getAssetBatch",
        params: { ids: mintAddresses },
      }),
    });

    const json = await res.json();
    const assets: any[] = json.result ?? [];

    for (const asset of assets) {
      const id = asset.id;
      const content = asset.content ?? {};
      const metadata = content.metadata ?? {};
      const links = content.links ?? {};
      result.set(id, {
        symbol:
          metadata.symbol ??
          asset.token_info?.symbol ??
          id.slice(0, 4).toUpperCase(),
        name: metadata.name ?? asset.token_info?.name ?? "Unknown Token",
        logoUri: links.image ?? undefined,
      });
    }
  } catch {
    // DAS unavailable — fall back to empty metadata (symbol derived from mint)
  }

  return result;
}

export async function getWalletTokens(
  walletAddress: string,
  includeEmpty = false
): Promise<WalletToken[]> {
  const connection = new Connection(RPC_ENDPOINT, "confirmed");
  const pubkey = new PublicKey(walletAddress);

  const [lamports, v1Accounts, v2Accounts] = await Promise.all([
    connection.getBalance(pubkey, "confirmed"),
    connection.getParsedTokenAccountsByOwner(pubkey, {
      programId: TOKEN_PROGRAM_ID,
    }),
    connection.getParsedTokenAccountsByOwner(pubkey, {
      programId: TOKEN_2022_PROGRAM_ID,
    }),
  ]);

  type AccountEntry = {
    accountAddress: string;
    programId: "TOKEN" | "TOKEN_2022";
    info: any;
  };
  const entries: AccountEntry[] = [
    ...v1Accounts.value.map((a) => ({
      accountAddress: a.pubkey.toString(),
      programId: "TOKEN" as const,
      info: a.account.data.parsed.info,
    })),
    ...v2Accounts.value.map((a) => ({
      accountAddress: a.pubkey.toString(),
      programId: "TOKEN_2022" as const,
      info: a.account.data.parsed.info,
    })),
  ];

  const filtered = includeEmpty
    ? entries
    : entries.filter((e) => (e.info.tokenAmount?.uiAmount ?? 0) > 0);
  const mintAddresses = filtered.map((e) => e.info.mint as string);
  const dasMetadata = await fetchDasMetadata(mintAddresses);

  const splTokens = filtered.map((e) => {
    const mint = e.info.mint as string;
    const tokenAmount = e.info.tokenAmount;
    const meta = dasMetadata.get(mint);
    return {
      accountAddress: e.accountAddress,
      mintAddress: mint,
      programId: e.programId,
      balance: Number(tokenAmount.amount),
      decimals: tokenAmount.decimals,
      uiBalance: tokenAmount.uiAmount ?? 0,
      symbol: meta?.symbol ?? mint.slice(0, 4).toUpperCase(),
      name: meta?.name ?? "Unknown Token",
      logoUri: meta?.logoUri,
    };
  });

  const spendableLamports = Math.max(
    0,
    lamports - SOL_RENT_AND_FEE_RESERVE_LAMPORTS
  );
  const solToken: WalletToken = {
    accountAddress: walletAddress,
    mintAddress: NATIVE_SOL_MINT,
    programId: "TOKEN",
    balance: spendableLamports,
    decimals: SOL_DECIMALS,
    uiBalance: spendableLamports / 10 ** SOL_DECIMALS,
    symbol: "SOL",
    name: "Solana",
  };

  return includeEmpty || spendableLamports > 0
    ? [solToken, ...splTokens]
    : splTokens;
}
