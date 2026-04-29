# ASTRDS

Browser-based Asteroids with Solana wallet auth and on-chain token rewards. Connect a wallet, pay to play, collect $ASTRDS tokens during gameplay, claim them on game over. Third parties can deposit any SPL token into the on-chain vault — those tokens spawn as collectibles in-game and are claimed by players via on-chain vault instructions.

Live at [astrds.ndao.computer](https://astrds.ndao.computer)

## Stack

- **Frontend** — React 18, TypeScript, Vite, Tailwind CSS
- **State** — Zustand (13 stores + typed state machine)
- **Blockchain** — Solana web3.js, wallet-adapter, SPL Token (Token-2022 + legacy), Anchor vault program
- **Backend** — Convex (DB, reactive queries, serverless actions, HTTP router)
- **Game server** — Node.js WebSocket server (`server/`) — authoritative loop at 30 tick/s; deployed to Railway
- **Webhooks** — Helius Enhanced Transactions (watches Space Vault Program ID)
- **Package manager** — pnpm (app/, server/), npm (Anchor root)

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
VITE_WS_URL=ws://localhost:3001   # WebSocket server URL; defaults to localhost:3001 if not set
```

Required env vars in Convex dashboard (not in `.env.local`):

```
PROGRAM_AUTHORITY_PRIVATE_KEY   # JSON array — authority keypair for ed25519 claim/mint signing
SOLANA_RPC_ENDPOINT             # RPC URL used by Convex actions
HELIUS_WEBHOOK_SECRET           # Shared secret validated on every webhook POST
ADMIN_API_KEY                   # Required for admin config HTTP endpoint
```

`pnpm start` runs Vite only (no Convex) — useful for frontend-only changes.

### Game Server

The game server is required — it owns the authoritative game loop. The browser is a pure renderer.

```bash
cd server
pnpm install
pnpm dev       # starts on port 3001
```

Required env vars in `server/.env`:

```
CONVEX_URL=https://your-deployment.convex.cloud
CONVEX_SITE_URL=https://your-deployment.convex.site   # optional; derived from CONVEX_URL if omitted
SOLANA_RPC_URL=https://api.devnet.solana.com           # optional; used for Meteora pool reads
ADMIN_API_KEY=<same key as Convex>                     # used to consume sessions and POST game-over ASTRDS accounting
```

`ServerGameScreen` connects to `VITE_WS_URL` if set, otherwise defaults to `ws://localhost:3001`.

## ASTRDS Token

- **Mint** — `5sqKSHDKZr4KbNzj972PSfmEhtR9eLeBvv1nBRbeQAnB` (devnet, Token-2022)
- **Mint authority** — VaultConfig PDA `6zsWYibNCYYQJikHv8BHXRNynEACgFKsZPNXqWqBPbvv` (on-chain only — no direct keypair minting)
- **Symbol** — $ASTRDS
- **Decimals** — 9
- **Metadata URI** — https://astrds.ndao.computer/token.json
- **Max per game** — 50 ASTRDS (procyclical emission tiers; tier 1–5 by pool price; uncollected pills burned)
- Minting requires an on-chain `mint_astrds` instruction — the game server writes the earned amount to Convex, `prepareMint` signs an ed25519 authorization, the client submits the tx
- See [docs/economy.md](docs/economy.md) for the full emission model

## Tokens in Space

Any SPL token (Token-2022 or legacy) can be deposited into the on-chain vault. Deposited tokens spawn as collectibles during gameplay and are claimed by players via on-chain `claim` instructions. The vault program verifies an ed25519 signature from the Convex authority before releasing tokens, creating an on-chain `ClaimRecord` for replay protection.

Deposit amounts are verified on-chain — the server reads `tx.meta` directly, never trusting client input for amounts. Helius webhooks watch the Space Vault Program ID and detect external drains. An hourly Convex cron (`reconcileAllPools`) reconciles pool balances against on-chain reality.

## Docs

- [docs/architecture.md](docs/architecture.md) — system overview, layers, data flow
- [docs/status.md](docs/status.md) — what's working, what's rough, what's next
- [docs/spec.md](docs/spec.md) — full product spec and functional requirements
- [docs/chain.md](docs/chain.md) — on-chain addresses, PDAs, flow diagrams
- [docs/economy.md](docs/economy.md) — token economy design, emission model, flywheel
- [docs/security.md](docs/security.md) — security findings, fixed exploits, pre-mainnet blockers
