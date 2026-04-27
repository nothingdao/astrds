// src/components/common/MenuButton.tsx

import React from 'react'
import { MenuButtonProps } from '@/types/components/menu'

const variantClasses = {
  default: 'border-primary text-primary hover:bg-primary hover:text-primary-foreground',
  primary: 'border-[var(--text-success)] text-tx-success hover:bg-[var(--text-success)] hover:text-primary-foreground',
  danger: 'border-destructive text-destructive hover:bg-destructive hover:text-primary-foreground',
  quarter: 'border-[var(--text-success)] text-tx-success hover:bg-[var(--text-success)] hover:text-primary-foreground hover:shadow-[var(--shadow-accent-glow)]'
}

const sizeClasses = {
  sm: 'px-4 py-2 text-sm',
  md: 'px-6 py-3 text-base',
  lg: 'px-8 py-4 text-lg'
}

const MenuButton: React.FC<MenuButtonProps> = ({
  onClick,
  disabled = false,
  loading = false,
  variant = 'default',
  size = 'md',
  className = '',
  children,
  icon
}) => (
  <button
    onClick={onClick}
    disabled={disabled || loading}
    className={`
      bg-transparent border-2 font-arcade
      transition-all duration-300 relative overflow-hidden
      disabled:bg-muted disabled:border-border 
      disabled:text-muted-foreground disabled:cursor-not-allowed 
      disabled:hover:shadow-none
      ${variantClasses[variant]}
      ${sizeClasses[size]}
      ${loading ? 'pr-12' : ''}
      ${className}
    `}
  >
    <div className='flex items-center justify-center gap-2'>
      {icon && <span className='text-current'>{icon}</span>}
      {children}
    </div>
    {loading && (
      <span className='absolute right-4 top-1/2 -translate-y-1/2 w-2 h-2 
                      bg-current rounded-full animate-[blink_1s_infinite]' />
    )}
  </button>
)

export default MenuButton
