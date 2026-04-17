// src/components/common/ActionButtons.tsx

import React from 'react'
import { ActionButtonsProps } from '@/types/components/menu'

const spacingClasses = {
  sm: 'gap-2',
  md: 'gap-4',
  lg: 'gap-6'
}

const alignClasses = {
  left: 'items-start',
  center: 'items-center',
  right: 'items-end'
}

const ActionButtons: React.FC<ActionButtonsProps> = ({
  children,
  align = 'center',
  spacing = 'md',
  className = ''
}) => (
  <div className={`
    flex flex-col 
    ${spacingClasses[spacing]} 
    ${alignClasses[align]} 
    ${className}
  `}>
    {children}
  </div>
)

export default ActionButtons
