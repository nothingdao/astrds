// src/services/audio/SoundMap.ts
// ─────────────────────────────────────────────────────────────────
// SINGLE SOURCE OF TRUTH for what plays when.
// Edit this file to change music, stingers, and entry sounds.
// All ids must match keys registered in AudioConfig.ts.
// ─────────────────────────────────────────────────────────────────

export type ScreenMusicEntry = {
  /** Music track id to start (null = keep whatever is currently playing) */
  music: string | null
  /** One-shot sound effect to fire when entering this state */
  enter: string | null
}

export type LevelBand = {
  from: number
  to: number
  music: string
}

export type SoundMapConfig = {
  screens: Record<string, ScreenMusicEntry>
  levelBands: LevelBand[]
  /** Pool of stinger sound ids — one picked at random on each level advance */
  levelAdvanceStingers: string[]
}

export const SOUND_MAP: SoundMapConfig = {
  screens: {
    INITIAL: {
      music: 'titleMusic',
      enter: null,
    },
    READY_TO_PLAY: {
      music: 'readyMusic',
      enter: 'quarterInsert',
    },
    PLAYING: {
      music: 'gameMusic',
      enter: null,
    },
    PAUSED: {
      // null = keep game music playing while paused
      music: null,
      enter: null,
    },
    GAME_OVER: {
      music: 'gameOverMusic',
      enter: 'gameOver',
    },
  },

  // Music per level range.
  // Evaluated in order — first matching band wins.
  // Add more bands (and register tracks in AudioConfig) as you collect music.
  levelBands: [
    { from: 1, to: 999, music: 'gameMusic' },
  ],

  // Random stinger pool for level advance.
  // Add / remove ids here to adjust the pool.
  levelAdvanceStingers: [
    'joi-lets-fly',
    'joi-whoa',
    'joi-space',
    'joi-helmet',
  ],
}
