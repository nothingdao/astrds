/**
 * One-time script to initialize the VaultConfig PDA on devnet.
 * Run: npx ts-node scripts/initialize-vault.ts
 *
 * Wallets used:
 *   authority (signer)   = ~/.config/solana/id.json  (jrXCZwP8bx...)
 *   convex_authority     = CNhWD1cXNaCMcjJmFcK25aFgV3ZTAFtyFDBvGfKZcpzF  (Convex/treasury)
 *   operational_wallet   = jrXCZwP8bxDnGs7ChD4F77We1K4J89R53SAVk5HsSoE  (deployer — devnet placeholder)
 *   operator_wallet      = jrXCZwP8bxDnGs7ChD4F77We1K4J89R53SAVk5HsSoE
 *   buyback_wallet       = jrXCZwP8bxDnGs7ChD4F77We1K4J89R53SAVk5HsSoE
 */

import * as anchor from "@coral-xyz/anchor";
import { web3 } from "@coral-xyz/anchor";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const PROGRAM_ID = new web3.PublicKey(
  "4bRZK8XfziVhLCgvtRdFJyTgN6tXGSPJT8xfbtt1AxBB"
);
const CONVEX_AUTHORITY = new web3.PublicKey(
  "CNhWD1cXNaCMcjJmFcK25aFgV3ZTAFtyFDBvGfKZcpzF"
);

// payment_weights must sum to 10,000 bps (100%)
const WEIGHTS = {
  operationalBps: 5000, // 50%
  operatorBps: 3000, // 30%
  buybackBps: 2000, // 20%
};
const BUYBACK_RATE = 0; // not used yet

async function main() {
  const keypath = path.join(os.homedir(), ".config/solana/id.json");
  const raw = JSON.parse(fs.readFileSync(keypath, "utf8"));
  const deployer = web3.Keypair.fromSecretKey(Uint8Array.from(raw));

  const connection = new web3.Connection(
    "https://api.devnet.solana.com",
    "confirmed"
  );
  const wallet = new anchor.Wallet(deployer);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);

  const idl = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "../target/idl/space_vault_program.json"),
      "utf8"
    )
  );
  const program = new anchor.Program(idl, provider);

  const [vaultConfigPda] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("vault-config")],
    PROGRAM_ID
  );

  console.log("Authority (deployer):", deployer.publicKey.toBase58());
  console.log("VaultConfig PDA:     ", vaultConfigPda.toBase58());
  console.log("Convex authority:    ", CONVEX_AUTHORITY.toBase58());

  // Check if already initialized
  const existing = await connection.getAccountInfo(vaultConfigPda);
  if (existing) {
    console.log("VaultConfig already exists — nothing to do.");
    const config = await (program.account as any).vaultConfig.fetch(
      vaultConfigPda
    );
    console.log("Current config:", JSON.stringify(config, null, 2));
    return;
  }

  const tx = await (program.methods as any)
    .initialize(
      WEIGHTS,
      new anchor.BN(BUYBACK_RATE),
      CONVEX_AUTHORITY,
      deployer.publicKey, // operational_wallet (devnet placeholder)
      deployer.publicKey, // operator_wallet
      deployer.publicKey // buyback_wallet
    )
    .accounts({
      authority: deployer.publicKey,
      vaultConfig: vaultConfigPda,
      systemProgram: web3.SystemProgram.programId,
    })
    .rpc();

  console.log("✓ VaultConfig initialized. Tx:", tx);
  console.log("VaultConfig PDA:", vaultConfigPda.toBase58());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
