import { httpRouter } from "convex/server";
import { handleTreasuryWebhook } from "./webhookHandlers";
import { updateConfigHttp } from "./admin";
import { setAstrdsEarnedHttp } from "./gameSessions";
import { consumeSessionHttp } from "./sessions";
import { solUsdPriceHttp } from "./prices";

const http = httpRouter();

// Helius Enhanced Transaction webhook — fires on every Space Vault program tx.
// Configure in Helius dashboard: address = 4bRZK8XfziVhLCgvtRdFJyTgN6tXGSPJT8xfbtt1AxBB,
// type = Enhanced, URL = https://colorful-nightingale-908.convex.site/treasury-webhook
// Set HELIUS_WEBHOOK_SECRET in Convex dashboard env vars.
http.route({
  path: "/treasury-webhook",
  method: "POST",
  handler: handleTreasuryWebhook,
});

// Admin config — requires ADMIN_API_KEY env var (set in Convex dashboard).
// POST /admin/config with Authorization: Bearer <key> and JSON body.
http.route({
  path: "/admin/config",
  method: "POST",
  handler: updateConfigHttp,
});

http.route({
  path: "/admin/config",
  method: "OPTIONS",
  handler: updateConfigHttp,
});

// Game server only — sets astrdsEarned after game over. Requires ADMIN_API_KEY.
http.route({
  path: "/game-server/set-astrds-earned",
  method: "POST",
  handler: setAstrdsEarnedHttp,
});

// Game server only — consumes a paid session at game admission. Requires ADMIN_API_KEY.
http.route({
  path: "/game-server/consume-session",
  method: "POST",
  handler: consumeSessionHttp,
});

http.route({
  path: "/game-server/consume-session",
  method: "OPTIONS",
  handler: consumeSessionHttp,
});

// Cached SOL/USD price feed used by the game server.
http.route({
  path: "/prices/sol-usd",
  method: "GET",
  handler: solUsdPriceHttp,
});

export default http;
