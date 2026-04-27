// src/components/common/Buttons.tsx
// Re-exports from shadcn Button with game-specific convenience wrappers
import React from 'react'
import { Button } from '@/components/ui/button'

export { Button }

export const QuarterButton = (props: React.ComponentProps<typeof Button>) => (
  <Button variant='quarter' size='lg' {...props}>
    {props.children ?? 'Insert Quarter'}
  </Button>
)

export const ChatButton = (props: React.ComponentProps<typeof Button>) => (
  <Button variant='default' size='sm' {...props}>
    {props.children ?? 'Chat'}
  </Button>
)

export const StyledWalletButton = ({ children }: { children: React.ReactNode }) => (
  <div
    className='[&>.wallet-adapter-button]:bg-transparent
               [&>.wallet-adapter-button]:border-2
               [&>.wallet-adapter-button]:border-primary
               [&>.wallet-adapter-button]:text-primary
               [&>.wallet-adapter-button]:font-arcade
               [&>.wallet-adapter-button]:px-6
               [&>.wallet-adapter-button]:py-3
               [&>.wallet-adapter-button]:text-sm
               [&>.wallet-adapter-button]:uppercase
               [&>.wallet-adapter-button]:transition-all
               [&>.wallet-adapter-button]:duration-300
               [&>.wallet-adapter-button:hover]:bg-primary
               [&>.wallet-adapter-button:hover]:text-primary-foreground
               [&>.wallet-adapter-button:hover]:shadow-[var(--shadow-accent-glow)]
               [&>.wallet-adapter-button:not(:disabled):hover]:bg-primary'
  >
    {children}
  </div>
)
