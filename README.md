# ASTRDS

Browser-based Asteroids with Solana wallet auth and on-chain token rewards. Connect a wallet, pay to play, collect $ASTRDS tokens during gameplay, claim them on game over.

Live at [astrds.ndao.computer](https://astrds.ndao.computer)

## Stack

- **Frontend** — React 18, TypeScript, Vite, Tailwind CSS
- **State** — Zustand (9 stores + typed state machine)
- **Blockchain** — Solana web3.js, wallet-adapter, SPL Token (Token-2022)
- **Backend** — Convex (DB, reactive queries, serverless actions)
- **Package manager** — pnpm

## Running Locally

```bash
pnpm install
pnpm start          # Vite dev server (frontend only)
pnpm convex:dev     # Convex dev server (run in parallel)
```

Required env vars in `.env.local`:

```
VITE_CONVEX_URL=https://your-deployment.convex.cloud
VITE_SOLANA_RPC_ENDPOINT=https://...
```

## Token

- **Mint** — `5sqKSHDKZr4KbNzj972PSfmEhtR9eLeBvv1nBRbeQAnB` (devnet, Token-2022)
- **Symbol** — $ASTRDS
- **Decimals** — 9
- **Metadata URI** — https://astrds.ndao.computer/token.json
- Tokens are minted 1:1 per token collected in-game (max 200/game)

## Docs

- [docs/architecture.md](docs/architecture.md) — system overview, layers, data flow
- [docs/status.md](docs/status.md) — what's working, what's rough, what's next
