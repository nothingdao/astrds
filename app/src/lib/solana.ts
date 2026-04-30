import { Connection } from "@solana/web3.js";

const NETWORK = "devnet";
const apiKey = import.meta.env.VITE_HELIUS_API_KEY;

export const RPC_ENDPOINT =
  import.meta.env.VITE_SOLANA_RPC_ENDPOINT ||
  `https://${NETWORK}.helius-rpc.com/?api-key=${apiKey}`;

export const connection = new Connection(RPC_ENDPOINT, "confirmed");
