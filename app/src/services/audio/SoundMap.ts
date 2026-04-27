// src/services/audio/SoundMap.ts
// ─────────────────────────────────────────────────────────────────
// SINGLE SOURCE OF TRUTH for what plays when.
// Edit this file to change music, stingers, buckets, and entry sounds.
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
  playlist: string[]
}

export type StingerDuckConfig = {
  targetVolume: number
  duckMs: number
  holdMs: number
  restoreMs: number
}

export type SfxBucketId =
  | 'asteroidDestroyLarge'
  | 'asteroidDestroyMedium'
  | 'asteroidDestroySmall'
  | 'spaceTokenCollect'
  | 'personalBest'
  | 'newTopScore'
  | 'streak'

export type StingerPlaylistId =
  | 'levelAdvance'
  | 'streak'
  | 'personalBest'
  | 'newTopScore'

export type SoundMapConfig = {
  screens: Record<string, ScreenMusicEntry>
  levelBands: LevelBand[]
  sfxBuckets: Record<SfxBucketId, string[]>
  stingerPlaylists: Record<StingerPlaylistId, string[]>
  stingerDuck: StingerDuckConfig
}

export const SOUND_MAP: SoundMapConfig = {
  screens: {
    INITIAL: {
      music: 'titleMusic',
      enter: null,
    },
    READY_TO_PLAY: {
      music: 'readyMusic',
      enter: null,
    },
    PLAYING: {
      // PLAYING music is controlled by levelBands.
      music: null,
      enter: null,
    },
    PAUSED: {
      // null = keep game music playing while paused; AudioManager ducks it.
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
  // Single-track playlists loop that track. Multi-track playlists rotate through
  // a shuffled order and reshuffle after each full rotation.
  levelBands: [
    { from: 1, to: 999, playlist: ['gameMusic'] },
  ],

  // SFX buckets use shuffle-without-replacement. Duplicate ids are acceptable
  // placeholders until more variant assets exist.
  sfxBuckets: {
    asteroidDestroyLarge: ['explosion'],
    asteroidDestroyMedium: ['explosion'],
    asteroidDestroySmall: ['explosion'],
    spaceTokenCollect: ['collect', 'spaceWind'],
    personalBest: ['gameOver'],
    newTopScore: ['gameOver'],
    streak: [],
  },

  // Stingers play over music on the stingers channel and duck music.
  stingerPlaylists: {
    levelAdvance: [
      'joi-lets-fly',
      'joi-whoa',
      'joi-space',
      'joi-helmet',
    ],
    streak: [],
    personalBest: [],
    newTopScore: [],
  },

  stingerDuck: {
    targetVolume: 0.3,
    duckMs: 200,
    holdMs: 0,
    restoreMs: 800,
  },
}
