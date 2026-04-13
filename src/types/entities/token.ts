// src/types/entities/token.ts
import { BaseEntity } from '../core'

export interface TokenMetadata {
  symbol: string
  value: number
  mineable: boolean
  mintAddress?: string  // set for space tokens
}

export interface TokenConfig {
  screen: {
    width: number
    height: number
  }
  type?: string
  color?: string
  metadata?: TokenMetadata
}

export interface TokenState extends BaseEntity {
  type: string
  timeToLive: number
  creation: number
  color: string
  metadata: TokenMetadata
  isPendingCollection: boolean // Add this line
}

export interface TokenMethods {
  destroy: () => void
  render: (state: GameScreenState) => void
}

export interface GameScreenState {
  context: CanvasRenderingContext2D
  screen: {
    width: number
    height: number
  }
}

export const TOKEN_TYPES: { [key: string]: TokenMetadata } = {
  ASTRDS: {
    symbol: 'ASTRDS',
    value: 1,
    mineable: true,
  },
  // Can add other token types here
}
