import { httpRouter } from 'convex/server'
import { handleTreasuryWebhook } from './webhookHandlers'

const http = httpRouter()

// Helius Enhanced Transaction webhook — fires on every treasury wallet transfer.
// Configure in Helius dashboard: address = TREASURY_WALLET, type = Enhanced,
// URL = https://https://colorful-nightingale-908.convex.site/treasury-webhook
// Set HELIUS_WEBHOOK_SECRET in Convex dashboard env vars.
http.route({
  path: '/treasury-webhook',
  method: 'POST',
  handler: handleTreasuryWebhook,
})

export default http
