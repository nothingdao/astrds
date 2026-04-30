const anchor = require("@coral-xyz/anchor");
const web3 = anchor.web3;
const fs = require("fs");
const os = require("os");
const path = require("path");

const PROGRAM_ID = new web3.PublicKey(
  "4bRZK8XfziVhLCgvtRdFJyTgN6tXGSPJT8xfbtt1AxBB"
);
const CONVEX_AUTHORITY = new web3.PublicKey(
  "CNhWD1cXNaCMcjJmFcK25aFgV3ZTAFtyFDBvGfKZcpzF"
);

const WEIGHTS = { operationalBps: 5000, operatorBps: 3000, buybackBps: 2000 };
const BUYBACK_RATE = 0;

async function main() {
  const raw = JSON.parse(
    fs.readFileSync(path.join(os.homedir(), ".config/solana/id.json"), "utf8")
  );
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

  const existing = await connection.getAccountInfo(vaultConfigPda);
  if (existing) {
    console.log("VaultConfig already initialized.");
    const config = await program.account.vaultConfig.fetch(vaultConfigPda);
    console.log(JSON.stringify(config, null, 2));
    return;
  }

  const tx = await program.methods
    .initialize(
      WEIGHTS,
      new anchor.BN(BUYBACK_RATE),
      CONVEX_AUTHORITY,
      deployer.publicKey,
      deployer.publicKey,
      deployer.publicKey
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
