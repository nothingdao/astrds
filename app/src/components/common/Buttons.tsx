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
      style={{
        display: 'flex',
        alignItems: 'stretch',
        background: '#0d0000',
        border: '3px solid #000',
        borderRadius: '6px',
        boxShadow: '0 6px 0 #000, 0 8px 16px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,80,80,0.15)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled && !isLoading ? 0.45 : 1,
        padding: 0,
        overflow: 'hidden',
        userSelect: 'none',
        transition: 'box-shadow 0.1s, transform 0.1s',
        minWidth: '200px',
        fontFamily: 'inherit',
      }}
      onMouseDown={(e) => {
        if (!disabled) {
          e.currentTarget.style.boxShadow = '0 2px 0 #000, 0 4px 8px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,80,80,0.15)'
          e.currentTarget.style.transform = 'translateY(3px)'
        }
      }}
      onMouseUp={(e) => {
        e.currentTarget.style.boxShadow = '0 6px 0 #000, 0 8px 16px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,80,80,0.15)'
        e.currentTarget.style.transform = 'translateY(0)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '0 6px 0 #000, 0 8px 16px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,80,80,0.15)'
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      {/* Coin slot strip */}
      <div style={{
        width: '26px',
        background: 'linear-gradient(to right, #1a0000, #0d0000)',
        borderRight: '2px solid #000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        <div style={{
          width: '10px',
          height: '3px',
          background: '#000',
          borderRadius: '1px',
          boxShadow: 'inset 0 1px 3px rgba(0,0,0,1), 0 1px 0 rgba(180,30,30,0.3)',
        }} />
      </div>

      {/* Main face */}
      <div style={{
        flex: 1,
        background: 'linear-gradient(160deg, #7a0000 0%, #5c0000 50%, #3d0000 100%)',
        margin: '3px',
        borderRadius: '3px',
        border: '2px solid #000',
        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.6), inset 0 -1px 0 rgba(255,60,60,0.1)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '10px 18px',
        gap: '1px',
      }}>
        {isLoading ? (
          <div style={{
            color: '#ff4444',
            fontSize: '11px',
            letterSpacing: '0.15em',
            textShadow: '0 1px 2px #000, 0 0 8px rgba(255,60,60,0.4)',
            fontFamily: '"Press Start 2P", monospace',
            textAlign: 'center',
            lineHeight: 1.6,
          }}>
            {label}
          </div>
        ) : (
          <>
            <div style={{
              color: '#ff3333',
              fontSize: '15px',
              fontWeight: 900,
              letterSpacing: '0.05em',
              textShadow: '1px 1px 0 #000, -1px -1px 0 rgba(255,120,120,0.2), 0 0 8px rgba(200,0,0,0.5)',
              fontFamily: 'Impact, "Arial Narrow", sans-serif',
              lineHeight: 1,
            }}>
              25¢
            </div>
            <div style={{
              color: '#cc2222',
              fontSize: '9px',
              letterSpacing: '0.2em',
              textShadow: '1px 1px 0 #000',
              fontFamily: 'Impact, "Arial Narrow", sans-serif',
              lineHeight: 1.2,
            }}>
              INSERT COIN TO
            </div>
            <div style={{
              color: '#ff3333',
              fontSize: '18px',
              fontWeight: 900,
              letterSpacing: '0.1em',
              textShadow: '1px 1px 0 #000, -1px -1px 0 rgba(255,120,120,0.2), 0 0 10px rgba(200,0,0,0.6)',
              fontFamily: 'Impact, "Arial Narrow", sans-serif',
              lineHeight: 1,
            }}>
              PLAY
            </div>
          </>
        )}
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
