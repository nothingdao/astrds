// src/types/components/menu.ts

import { ReactNode } from 'react'

export interface MenuButtonProps {
  onClick: () => void
  disabled?: boolean
  loading?: boolean
  variant?: 'default' | 'primary' | 'danger' | 'quarter'
  size?: 'sm' | 'md' | 'lg'
  className?: string
  children: ReactNode
  icon?: ReactNode
}

export interface GameTitleProps {
  subtitle?: string
  animate?: boolean
  className?: string
}

export interface ActionButtonsProps {
  align?: 'left' | 'center' | 'right'
  spacing?: 'sm' | 'md' | 'lg'
  className?: string
  children: ReactNode
}

export interface MenuOverlayProps {
  isVisible: boolean
  onClose: () => void
  title: string
  subtitle?: string
  className?: string
  children: ReactNode
  blur?: boolean
  showCloseButton?: boolean
}

export interface MenuItemProps {
  label: string
  onClick: () => void
  icon?: ReactNode
  disabled?: boolean
  loading?: boolean
  variant?: 'default' | 'primary' | 'danger'
  description?: string
}
