// src/types/core.ts

// I propose we get rid of this core file and move the types to their respective files.

export type Vector2D = {
  x: number
  y: number
}

export interface BaseEntity {
  id: string
  position: Vector2D
  velocity: Vector2D
  rotation: number
  radius: number
  delete: boolean
}

// Score related types
export interface Score {
  walletAddress: string
  score: number
  date: string
}

export interface GameStats {
  score: number
  rank: number
  isHighScore: boolean
  totalPlayers: number
}
