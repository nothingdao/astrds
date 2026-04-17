# ASTRDS

Browser-based Asteroids with Solana wallet auth and on-chain token rewards. Connect a wallet, pay to play, collect $ASTRDS tokens during gameplay, claim them on game over. Third parties can deposit any SPL token into the game treasury — those tokens spawn as collectibles in-game and are claimed by players on game over.

Live at [astrds.ndao.computer](https://astrds.ndao.computer)

## Stack

- **Frontend** — React 18, TypeScript, Vite, Tailwind CSS
- **State** — Zustand (9 stores + typed state machine)
- **Blockchain** — Solana web3.js, wallet-adapter, SPL Token (Token-2022 + legacy)
- **Backend** — Convex (DB, reactive queries, serverless actions, HTTP router)
- **Webhooks** — Helius Enhanced Transactions (treasury wallet monitoring)
- **Package manager** — pnpm

## Running Locally

```bash
pnpm install
pnpm dev       # runs Vite + Convex concurrently
```

Required env vars in `.env.local`:

```
VITE_CONVEX_URL=https://your-deployment.convex.cloud
VITE_HELIUS_API_KEY=your-helius-api-key
```

Required env vars in Convex dashboard (not in `.env.local`):

```
PROGRAM_AUTHORITY_PRIVATE_KEY   # JSON array — authority keypair for minting + claim transfers
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

Any SPL token (Token-2022 or legacy) can be deposited into the game treasury. Deposited tokens spawn as collectibles during gameplay and are claimed by players on game over. Deposit amounts are verified on-chain — the server reads `tx.meta` directly, never trusting client input.

Helius webhooks watch the treasury wallet and automatically activate deposits and detect external drains. An hourly Convex cron (`reconcileAllPools`) reconciles pool balances against on-chain reality as a safety net.

## Docs

- [docs/architecture.md](docs/architecture.md) — system overview, layers, data flow
- [docs/status.md](docs/status.md) — what's working, what's rough, what's next
- [SPEC.md](SPEC.md) — full product spec and functional requirements
