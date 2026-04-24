import { ConvexHttpClient } from 'convex/browser'
import type { FunctionReference } from 'convex/server'

const GAME_SESSIONS_UPDATE = 'gameSessions:update'
const GAME_SESSIONS_INCREMENT_PILLS = 'gameSessions:incrementPillsCollected'
const SPACE_DEPOSITS_COLLECT = 'spaceDeposits:collectFromDeposit'

type ConvexFunctionName =
  | typeof GAME_SESSIONS_UPDATE
  | typeof GAME_SESSIONS_INCREMENT_PILLS
  | typeof SPACE_DEPOSITS_COLLECT

export class ConvexServerClient {
  private readonly client: ConvexHttpClient | null
  private hasWarnedMissingUrl = false

  constructor(url = process.env.CONVEX_URL) {
    this.client = url ? new ConvexHttpClient(url) : null
  }

  async updateGameSession(args: {
    sessionId: string
    score?: number
    levelReached?: number
    pillsCollected?: number
    status?: 'active' | 'ending' | 'ended'
  }): Promise<void> {
    await this.mutation(GAME_SESSIONS_UPDATE, args)
  }

  async incrementPillsCollected(args: { sessionId: string; amount?: number }): Promise<void> {
    await this.mutation(GAME_SESSIONS_INCREMENT_PILLS, args)
  }

  async collectFromDeposit(args: {
    spawnId: string
    playerWalletAddress: string
    gameSessionId: string
  }): Promise<void> {
    await this.mutation(SPACE_DEPOSITS_COLLECT, args)
  }

  private async mutation(name: ConvexFunctionName, args: Record<string, unknown>): Promise<unknown> {
    if (!this.client) {
      if (!this.hasWarnedMissingUrl) {
        this.hasWarnedMissingUrl = true
        console.warn('CONVEX_URL is not set; skipping server-side Convex mutations')
      }
      return null
    }

    return this.client.mutation(name as unknown as FunctionReference<'mutation'>, args)
  }
}
