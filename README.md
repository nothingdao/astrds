# ASTRDS

Browser-based Asteroids with Solana wallet auth and on-chain token rewards. Connect a wallet, pay to play, collect $ASTRDS tokens during gameplay, claim them on game over. Third parties can deposit any SPL token into the on-chain vault — those tokens spawn as collectibles in-game and are claimed by players via on-chain vault instructions.

Live at [astrds.ndao.computer](https://astrds.ndao.computer)

## Stack

- **Frontend** — React 18, TypeScript, Vite, Tailwind CSS
- **State** — Zustand (9 stores + typed state machine)
- **Blockchain** — Solana web3.js, wallet-adapter, SPL Token (Token-2022 + legacy), Anchor vault program
- **Backend** — Convex (DB, reactive queries, serverless actions, HTTP router)
- **Webhooks** — Helius Enhanced Transactions (treasury wallet monitoring)
- **Package manager** — pnpm

## Running Locally

```bash
cd app
pnpm install
pnpm dev       # runs Vite + Convex concurrently
```

Required env vars in `app/.env.local`:

```
VITE_CONVEX_URL=https://your-deployment.convex.cloud
VITE_HELIUS_API_KEY=your-helius-api-key
```

Required env vars in Convex dashboard (not in `.env.local`):

```
PROGRAM_AUTHORITY_PRIVATE_KEY   # JSON array — authority keypair for ASTRDS minting + ed25519 claim signing
SOLANA_RPC_ENDPOINT             # RPC URL used by Convex actions
HELIUS_WEBHOOK_SECRET           # Shared secret validated on every webhook POST
```

`pnpm start` runs Vite only (no Convex) — useful for frontend-only changes.

## ASTRDS Token

- **Mint** — `5sqKSHDKZr4KbNzj972PSfmEhtR9eLeBvv1nBRbeQAnB` (devnet, Token-2022)
- **Symbol** — $ASTRDS
- **Decimals** — 9
- **Metadata URI** — https://astrds.ndao.computer/token.json
- Minted 1:1 per token collected in-game (max 200/game)

## Tokens in Space

Any SPL token (Token-2022 or legacy) can be deposited into the on-chain vault. Deposited tokens spawn as collectibles during gameplay and are claimed by players via on-chain `claim` instructions. The vault program verifies an ed25519 signature from the Convex authority before releasing tokens, creating an on-chain `ClaimRecord` for replay protection.

Deposit amounts are verified on-chain — the server reads `tx.meta` directly, never trusting client input for amounts. Helius webhooks watch the treasury wallet and detect external drains. An hourly Convex cron (`reconcileAllPools`) reconciles pool balances against on-chain reality.

## Docs

- [docs/architecture.md](docs/architecture.md) — system overview, layers, data flow
- [docs/status.md](docs/status.md) — what's working, what's rough, what's next
- [docs/spec.md](docs/spec.md) — full product spec and functional requirements
- [docs/chain.md](docs/chain.md) — on-chain addresses, PDAs, flow diagrams
- [docs/economy.md](docs/economy.md) — token economy design, emission model, flywheel
