// src/services/audio/AudioConfig.ts
import {
  SOUND_TYPES,
  VOLUME_CHANNELS,
  MUSIC_TRACKS,
  EFFECT_LEVELS,
} from "./AudioTypes";

export const AUDIO_CONFIG = {
  sounds: {
    [SOUND_TYPES.SHOOT]: {
      path: "/sounds/shoot.wav",
      volume: 0.5,
      category: "sfx",
    },
    [SOUND_TYPES.EXPLOSION]: {
      path: "/sounds/explosion.wav",
      volume: 0.6,
      category: "sfx",
    },
    [SOUND_TYPES.THRUST]: {
      path: "/sounds/thrust.wav",
      volume: 0.4,
      category: "sfx",
    },
    [SOUND_TYPES.COLLECT]: {
      path: "/sounds/collect-pill.mp3",
      volume: 0.5,
      category: "sfx",
    },
    [SOUND_TYPES.QUARTER_INSERT]: {
      path: "/sounds/coin.wav",
      volume: 0.5,
      category: "sfx",
    },
    [SOUND_TYPES.COUNTDOWN_PING]: {
      path: "/sounds/ping.wav",
      volume: 0.5,
      category: "sfx",
    },
    [SOUND_TYPES.GAME_OVER]: {
      path: "/sounds/gameover.wav",
      volume: 0.5,
      category: "sfx",
    },
    [SOUND_TYPES.SPACE_WIND]: {
      path: "/sounds/space-wind.wav",
      volume: 0.4,
      category: "sfx",
    },

    // Level-advance stingers (joi voice clips)
    "joi-lets-fly": {
      path: "/sounds/joi/lets-fly-this-thing-out-of-here.mp3",
      volume: 0.7,
      category: "stingers",
    },
    "joi-whoa": {
      path: "/sounds/joi/whoa-that-guy-was-no-match-for-you.mp3",
      volume: 0.7,
      category: "stingers",
    },
    "joi-space": {
      path: "/sounds/joi/we-are-space.mp3",
      volume: 0.7,
      category: "stingers",
    },
    "joi-helmet": {
      path: "/sounds/joi/im-not-wearing-a-helmet-either.mp3",
      volume: 0.7,
      category: "stingers",
    },
  },

  music: {
    [MUSIC_TRACKS.TITLE]: {
      path: "/sounds/arcis.mp3",
      volume: 0.4,
      fadeInDuration: 1000,
      loop: true,
    },
    [MUSIC_TRACKS.READY]: {
      path: "/sounds/ready.wav",
      volume: 0.4,
      fadeInDuration: 500,
      loop: false,
    },
    [MUSIC_TRACKS.GAME]: {
      path: "/sounds/glass-and-buffalo-warrior-travel.mp3",
      volume: 0.4,
      fadeInDuration: 1000,
      loop: true,
    },
    [MUSIC_TRACKS.GAME_OVER]: {
      path: "/sounds/arcis.mp3",
      volume: 0.4,
      fadeInDuration: 1000,
      loop: false,
    },
  },

  effectSettings: {
    [SOUND_TYPES.SHOOT]: EFFECT_LEVELS.NORMAL,
    [SOUND_TYPES.EXPLOSION]: EFFECT_LEVELS.NORMAL,
    [SOUND_TYPES.THRUST]: EFFECT_LEVELS.NORMAL,
    [SOUND_TYPES.COLLECT]: EFFECT_LEVELS.NORMAL,
    [SOUND_TYPES.QUARTER_INSERT]: EFFECT_LEVELS.NORMAL,
    [SOUND_TYPES.COUNTDOWN_PING]: EFFECT_LEVELS.NORMAL,
    [SOUND_TYPES.GAME_OVER]: EFFECT_LEVELS.NORMAL,
    [SOUND_TYPES.SPACE_WIND]: EFFECT_LEVELS.NORMAL,
    "joi-lets-fly": EFFECT_LEVELS.NORMAL,
    "joi-whoa": EFFECT_LEVELS.NORMAL,
    "joi-space": EFFECT_LEVELS.NORMAL,
    "joi-helmet": EFFECT_LEVELS.NORMAL,
  },

  defaultVolumes: {
    [VOLUME_CHANNELS.MASTER]: 0.5,
    [VOLUME_CHANNELS.MUSIC]: 0.5,
    [VOLUME_CHANNELS.SFX]: 0.5,
    [VOLUME_CHANNELS.STINGERS]: 0.8,
  },
};
