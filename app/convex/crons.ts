import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

// Reconcile all active space deposit pools against on-chain treasury ATA balances.
// Catches external drains that webhooks would handle on mainnet but miss on devnet.
crons.interval('reconcile space pools', { hours: 1 }, internal.spaceDepositsActions.reconcileAllPools)

export default crons
