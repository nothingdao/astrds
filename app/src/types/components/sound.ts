// src/types/components/sound.ts
export interface SoundSettingsProps {
  isOpen: boolean
  onClose: () => void
}

export interface VolumeSliderProps {
  value: number
  onChange: (value: number) => void
  label?: string
  channel?: string
  showLabel?: boolean
  showIcon?: boolean
  className?: string
}

export interface EffectToggleProps {
  value: string
  onChange: (effectType: string, setting: string) => void
  label: string
  effectType: string
  className?: string
}

export interface EffectGroupProps {
  groupName: string
  effects: string[]
}

// Sound effect types
export type EffectType =
  | 'shoot'
  | 'thrust'
  | 'explosion'
  | 'collect'
  | 'quarterInsert'
  | 'countdownPing'
  | 'gameOver'
  | 'spaceWind'

// Effect groups and labels
export const EFFECT_GROUPS: Record<string, EffectType[]> = {
  'Weapon Sounds': ['shoot'],
  'Ship Sounds': ['thrust', 'explosion'],
  'Game Events': ['collect', 'quarterInsert', 'countdownPing', 'gameOver'],
  Ambient: ['spaceWind'],
}

export const EFFECT_LABELS: Record<EffectType, string> = {
  shoot: 'Weapon Fire',
  thrust: 'Engine Thrust',
  explosion: 'Explosions',
  collect: 'Item Collect',
  quarterInsert: 'Quarter Insert',
  countdownPing: 'Countdown',
  gameOver: 'Game Over',
  spaceWind: 'Space Wind',
}
