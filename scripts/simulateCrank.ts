import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { Connection, Keypair } from "../app/node_modules/@solana/web3.js";
import {
  buildCrankLiquidityTransaction,
  fetchLiquidityCrankState,
} from "../app/src/lib/spaceVault";

const connection = new Connection(
  process.env.SOLANA_RPC_ENDPOINT || "https://api.devnet.solana.com",
  "confirmed"
);

async function main() {
  const kpBytes = JSON.parse(
    readFileSync(join(homedir(), ".config/solana/id.json"), "utf8")
  );
  const cranker = Keypair.fromSecretKey(Uint8Array.from(kpBytes));
  const state = await fetchLiquidityCrankState(connection as any);
  console.log("cranker", cranker.publicKey.toBase58());
  console.log(
    "pendingLamports",
    state.pendingLamports,
    "pendingSol",
    state.pendingSol
  );
  console.log(
    "positionExists",
    state.positionExists,
    "positionLocked",
    state.positionLocked
  );
  if (state.pendingLamports <= 0) return;
  const built = await buildCrankLiquidityTransaction({
    connection: connection as any,
    cranker: cranker.publicKey,
    lamports: state.pendingLamports,
  });
  built.transaction.instructions.forEach((ix, i) => {
    console.log("ix", i, ix.programId.toBase58());
    ix.keys.forEach((k, j) =>
      console.log(j, k.pubkey.toBase58(), "w", k.isWritable, "s", k.isSigner)
    );
  });
  built.transaction.sign(cranker);
  const sim = await connection.simulateTransaction(built.transaction);
  console.log(JSON.stringify(sim.value, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
