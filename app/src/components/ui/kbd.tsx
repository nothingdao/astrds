import React from 'react'
import { cn } from '@/lib/utils'

const Kbd = React.forwardRef<HTMLElement, React.ComponentPropsWithoutRef<'kbd'>>(
  ({ className, ...props }, ref) => (
    <kbd
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center min-w-[1.4rem] h-5 px-1.5 font-mono text-[10px] font-medium',
        'bg-muted border border-border text-muted-foreground',
        'rounded-none select-none leading-none',
        className
      )}
      {...props}
    />
  )
)
Kbd.displayName = 'Kbd'

export { Kbd }
