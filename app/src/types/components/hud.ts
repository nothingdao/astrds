// src/types/components/hud.ts

export interface GameHUDProps {
  className?: string
}

export interface InventoryItemProps {
  type: 'ships' | 'tokens' | 'pills'
  count: number
  max: number
  label: string
  description: string
  icon: React.ReactNode
  onClick: () => void
  disabled?: boolean
  cooldown?: number
}

export interface ScoreHUDProps {
  className?: string
  animate?: boolean
}

export interface PowerupHUDProps {
  className?: string
}

export interface PowerupIndicatorProps {
  type: 'invincible' | 'rapidFire' | 'beam' | 'spread'
  active: boolean
  duration?: number
  icon: React.ReactNode
}

export interface CooldownIndicatorProps {
  duration: number
  remaining: number
  className?: string
}
