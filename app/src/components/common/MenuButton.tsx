// src/components/common/MenuButton.tsx

import React from 'react'
import { MenuButtonProps } from '@/types/components/menu'

const variantClasses = {
  default: 'border-game-blue text-game-blue hover:bg-game-blue hover:text-black',
  primary: 'border-game-green text-game-green hover:bg-game-green hover:text-black',
  danger: 'border-game-red text-game-red hover:bg-game-red hover:text-black',
  quarter: 'border-game-green text-game-green hover:bg-game-green hover:text-black hover:shadow-[0_0_15px_#4dff4d]'
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
      disabled:bg-neutral-800 disabled:border-neutral-800 
      disabled:text-neutral-600 disabled:cursor-not-allowed 
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
