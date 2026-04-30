import { Connection, PublicKey } from "@solana/web3.js";
import { RPC_ENDPOINT } from "@/lib/solana";
import {
  buildSendToSpaceTransaction as buildVaultDepositTransaction,
  type TokenProgramKind,
} from "@/lib/spaceVault";

export async function buildSendToSpaceTransaction(
  playerPublicKey: PublicKey,
  mintAddress: string,
  rawAmount: number,
  programId: TokenProgramKind
) {
  const connection = new Connection(RPC_ENDPOINT, "confirmed");
  return buildVaultDepositTransaction({
    connection,
    depositor: playerPublicKey,
    mintAddress,
    rawAmount,
    programId,
  });
}
