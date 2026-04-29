import { ConvexHttpClient } from 'convex/browser'
import type { FunctionReference } from 'convex/server'
import type { SpaceTokenPool } from '../../../shared/game/protocol.js'
import type { GameConfig } from '../game/gameConfig.js'
import { DEFAULT_GAME_CONFIG } from '../game/gameConfig.js'

const GAME_SESSIONS_UPDATE = 'gameSessions:update'
const SET_ASTRDS_EARNED_PATH = '/game-server/set-astrds-earned'
const CONSUME_SESSION_PATH = '/game-server/consume-session'
const GAME_SESSIONS_INCREMENT_PILLS = 'gameSessions:incrementPillsCollected'
const SPACE_DEPOSITS_COLLECT = 'spaceDeposits:collectFromDeposit'
const SPACE_DEPOSITS_GET_ACTIVE_POOLS = 'spaceDeposits:getActivePoolsForLevel'
const SPACE_DEPOSITS_REQUEST_SPAWN_TICKET = 'spaceDeposits:requestSpawnTicket'
const SESSIONS_IS_VERIFIED = 'sessions:isVerified'
const ADMIN_GET_GAME_CONFIG = 'admin:getGameConfig'

type ConvexFunctionName =
  | typeof GAME_SESSIONS_UPDATE
  | typeof GAME_SESSIONS_INCREMENT_PILLS
  | typeof SPACE_DEPOSITS_COLLECT
  | typeof SPACE_DEPOSITS_REQUEST_SPAWN_TICKET

type ConvexQueryName =
  | typeof SPACE_DEPOSITS_GET_ACTIVE_POOLS
  | typeof SESSIONS_IS_VERIFIED
  | typeof ADMIN_GET_GAME_CONFIG

export class ConvexServerClient {
  private readonly client: ConvexHttpClient | null
  private hasWarnedMissingUrl = false

  private readonly siteUrl: string

  constructor(url = process.env.CONVEX_URL) {
    this.client = url ? new ConvexHttpClient(url) : null
    // Convex HTTP actions live on .convex.site, not .convex.cloud
    this.siteUrl = process.env.CONVEX_SITE_URL ?? (url ?? '').replace('.convex.cloud', '.convex.site')
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

  async setAstrdsEarned(args: {
    sessionId: string
    amount: number
    amountRaw?: string
    allocated?: number
    burned?: number
  }): Promise<void> {
    const apiKey = process.env.ADMIN_API_KEY
    if (!apiKey) {
      console.warn('ADMIN_API_KEY not set — cannot write astrdsEarned to Convex')
      return
    }
    if (!this.siteUrl) {
      console.warn('Cannot derive Convex site URL — cannot write astrdsEarned')
      return
    }
    const resp = await fetch(`${this.siteUrl}${SET_ASTRDS_EARNED_PATH}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(args),
    })
    if (!resp.ok) {
      const text = await resp.text()
      throw new Error(`setAstrdsEarned failed: ${resp.status} ${text}`)
    }
  }

  async consumeSession(args: { walletAddress: string }): Promise<boolean> {
    const apiKey = process.env.ADMIN_API_KEY
    if (!apiKey) {
      console.warn('ADMIN_API_KEY not set — cannot consume verified session')
      return false
    }
    if (!this.siteUrl) {
      console.warn('Cannot derive Convex site URL — cannot consume verified session')
      return false
    }
    const resp = await fetch(`${this.siteUrl}${CONSUME_SESSION_PATH}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ walletAddress: args.walletAddress }),
    })
    if (!resp.ok) {
      const text = await resp.text()
      throw new Error(`consumeSession failed: ${resp.status} ${text}`)
    }
    const body = await resp.json() as { consumed?: unknown }
    return body.consumed === true
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
    if (!this.client) return true  // no CONVEX_URL = local dev, allow through
    const result = await this.query(SESSIONS_IS_VERIFIED, args)
    return result === true
  }

  async getGameConfig(): Promise<GameConfig> {
    const result = await this.query(ADMIN_GET_GAME_CONFIG, {})
    if (!result || typeof result !== 'object') return DEFAULT_GAME_CONFIG

    const r = result as Record<string, unknown>
    const numArr = (key: keyof GameConfig): number[] => {
      const v = r[key]
      return Array.isArray(v) && v.every(x => typeof x === 'number') ? v as number[] : DEFAULT_GAME_CONFIG[key] as number[]
    }
    const config: GameConfig = {
      ...DEFAULT_GAME_CONFIG,
      version: typeof r.version === 'number' ? r.version : 0,
      applyToRunning: Boolean(r.applyToRunning),
      quarterUsd: typeof r.quarterUsd === 'number' ? r.quarterUsd : DEFAULT_GAME_CONFIG.quarterUsd,
      tierBreakpointsUsd: numArr('tierBreakpointsUsd'),
      pillsPerTier: numArr('pillsPerTier'),
      astrdsPerPill: numArr('astrdsPerPill'),
      progressionBands: Array.isArray(r.progressionBands) ? r.progressionBands as GameConfig['progressionBands'] : DEFAULT_GAME_CONFIG.progressionBands,
    }

    for (const key of Object.keys(DEFAULT_GAME_CONFIG) as (keyof GameConfig)[]) {
      if (typeof DEFAULT_GAME_CONFIG[key] === 'number' && typeof r[key] === 'number') {
        ;(config as unknown as Record<string, unknown>)[key] = r[key]
      }
    }

    return config
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
