import { ConvexHttpClient } from 'convex/browser'
import type { FunctionReference } from 'convex/server'
import type { SpaceTokenPool } from '../../../shared/game/protocol.js'

const GAME_SESSIONS_UPDATE = 'gameSessions:update'
const GAME_SESSIONS_INCREMENT_PILLS = 'gameSessions:incrementPillsCollected'
const SPACE_DEPOSITS_COLLECT = 'spaceDeposits:collectFromDeposit'
const SPACE_DEPOSITS_GET_ACTIVE_POOLS = 'spaceDeposits:getActivePoolsForLevel'
const SPACE_DEPOSITS_REQUEST_SPAWN_TICKET = 'spaceDeposits:requestSpawnTicket'
const SESSIONS_IS_VERIFIED = 'sessions:isVerified'

type ConvexFunctionName =
  | typeof GAME_SESSIONS_UPDATE
  | typeof GAME_SESSIONS_INCREMENT_PILLS
  | typeof SPACE_DEPOSITS_COLLECT
  | typeof SPACE_DEPOSITS_REQUEST_SPAWN_TICKET

type ConvexQueryName = typeof SPACE_DEPOSITS_GET_ACTIVE_POOLS | typeof SESSIONS_IS_VERIFIED

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

  async getActivePoolsForLevel(args: { level: number }): Promise<SpaceTokenPool[]> {
    const result = await this.query(SPACE_DEPOSITS_GET_ACTIVE_POOLS, args)
    const pools = Array.isArray(result) ? result : []

    return pools
      .map((pool) => {
        if (!pool || typeof pool !== 'object') return null
        const candidate = pool as Record<string, unknown>
        if (
          typeof candidate._id !== 'string' ||
          typeof candidate.mintAddress !== 'string' ||
          typeof candidate.symbol !== 'string' ||
          typeof candidate.remainingAmount !== 'number' ||
          typeof candidate.tokensPerPill !== 'number'
        ) {
          return null
        }

        return {
          depositId: candidate._id,
          mintAddress: candidate.mintAddress,
          symbol: candidate.symbol,
          remainingAmount: candidate.remainingAmount,
          tokensPerPill: candidate.tokensPerPill,
          color: getTokenColor(candidate.mintAddress),
        } satisfies SpaceTokenPool
      })
      .filter((pool): pool is SpaceTokenPool => pool !== null)
  }

  async requestSpawnTicket(args: {
    depositId: string
    playerWalletAddress: string
    gameSessionId: string
  }): Promise<{ spawnId: string | null }> {
    const result = await this.mutation(SPACE_DEPOSITS_REQUEST_SPAWN_TICKET, args)
    if (!result || typeof result !== 'object' || !('spawnId' in result)) {
      return { spawnId: null }
    }

    const spawnId = (result as { spawnId?: unknown }).spawnId
    return { spawnId: typeof spawnId === 'string' ? spawnId : null }
  }

  async isVerifiedSession(args: { walletAddress: string }): Promise<boolean> {
    const result = await this.query(SESSIONS_IS_VERIFIED, args)
    return result === true
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

  private async query(name: ConvexQueryName, args: Record<string, unknown>): Promise<unknown> {
    if (!this.client) {
      if (!this.hasWarnedMissingUrl) {
        this.hasWarnedMissingUrl = true
        console.warn('CONVEX_URL is not set; skipping server-side Convex queries')
      }
      return null
    }

    return this.client.query(name as unknown as FunctionReference<'query'>, args)
  }
}

const SPACE_TOKEN_PALETTE = [
  '#a855f7',
  '#22d3ee',
  '#4ade80',
  '#fbbf24',
  '#f87171',
  '#f472b6',
  '#60a5fa',
  '#a3e635',
  '#e879f9',
  '#2dd4bf',
]

function getTokenColor(mintAddress: string): string {
  let hash = 0
  for (let i = 0; i < mintAddress.length; i += 1) {
    hash = (hash * 31 + mintAddress.charCodeAt(i)) & 0xffffffff
  }
  return SPACE_TOKEN_PALETTE[Math.abs(hash) % SPACE_TOKEN_PALETTE.length]
}
