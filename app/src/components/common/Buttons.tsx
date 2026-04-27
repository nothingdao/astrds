// src/components/common/Buttons.tsx
// Re-exports from shadcn Button with game-specific convenience wrappers
import React from 'react'
import { Button } from '@/components/ui/button'

export { Button }

export const QuarterButton = ({
  onClick,
  disabled,
  children,
}: {
  onClick?: () => void
  disabled?: boolean
  children?: React.ReactNode
}) => {
  const label = children?.toString() ?? ''
  const isLoading = disabled && (label.includes('Sending') || label.includes('Inserting') || label.includes('...'))

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={[
        'relative p-4 rounded-xl select-none transition-all duration-75',
        // Translucent plastic: warm top highlight fading to deep red — light bleeding through
        'bg-gradient-to-b from-orange-500 via-red-700 to-red-900',
        // Outer glow (backlit halo) + top specular edge + subtle inner warmth + physical drop
        'shadow-[0_6px_0_rgba(0,0,0,0.7),0_0_40px_rgba(220,70,0,0.55),0_0_80px_rgba(180,30,0,0.25),inset_0_1px_0_rgba(255,180,60,0.5),inset_0_0_28px_rgba(255,70,0,0.13)]',
        !disabled
          ? 'active:translate-y-1.5 active:shadow-[0_2px_0_rgba(0,0,0,0.7),0_0_30px_rgba(220,70,0,0.5),inset_0_0_28px_rgba(255,70,0,0.13)]'
          : '',
        disabled && !isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
      ].join(' ')}
    >
      {/* Corner screws */}
      <div className="absolute top-1.5 left-1.5 w-2 h-2 rounded-full bg-red-950 border border-orange-800/50 shadow-[inset_0_1px_1px_rgba(255,140,0,0.3)]" />
      <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-950 border border-orange-800/50 shadow-[inset_0_1px_1px_rgba(255,140,0,0.3)]" />
      <div className="absolute bottom-1.5 left-1.5 w-2 h-2 rounded-full bg-red-950 border border-orange-800/50 shadow-[inset_0_1px_1px_rgba(255,140,0,0.3)]" />
      <div className="absolute bottom-1.5 right-1.5 w-2 h-2 rounded-full bg-red-950 border border-orange-800/50 shadow-[inset_0_1px_1px_rgba(255,140,0,0.3)]" />

      <div className="flex flex-row items-stretch gap-2">
        {/* Quarter slot column */}
        <div className="flex flex-col items-center justify-center w-6 shrink-0 gap-3">
          {/* Coin slot opening — horizontal slit */}
          <div className="w-5 h-44 rounded-sm bg-neutral-950 shadow-[inset_0_1px_4px_rgba(0,0,0,1),0_1px_0_rgba(255,140,0,0.15)] border border-orange-950/80" />
        </div>

        {/* Inner dark display panel */}
        <div className={[
          'bg-neutral-950 rounded-lg px-6 py-6 flex flex-col items-center shadow-[inset_0_2px_10px_rgba(0,0,0,0.95)]',
          isLoading ? 'animate-flicker' : '',
        ].join(' ')}>
          <div className="text-amber-300 text-5xl leading-none mb-2 tracking-wide [font-family:Impact,'Arial_Narrow',sans-serif] [text-shadow:0_0_10px_rgba(255,150,0,0.9),0_0_22px_rgba(255,80,0,0.5)]">
            25¢
          </div>
          <div className="w-full h-px bg-orange-900/60 mb-2" />
          <div className="text-orange-500 text-[10px] tracking-[0.18em] text-center leading-snug [font-family:Impact,'Arial_Narrow',sans-serif]">
            INSERT COIN TO
          </div>
          <div className="text-amber-300 text-[44px] leading-none tracking-wide [font-family:Impact,'Arial_Narrow',sans-serif] [text-shadow:0_0_12px_rgba(255,150,0,0.9),0_0_28px_rgba(255,80,0,0.5)]">
            PLAY
          </div>
        </div>
      </div>
    </button>
  )
}

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
