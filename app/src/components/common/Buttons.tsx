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
        background: '#000',
        border: 'none',
        borderRadius: '3px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled && !isLoading ? 0.45 : 1,
        padding: '10px 10px 10px 6px',
        userSelect: 'none',
        display: 'flex',
        alignItems: 'stretch',
        gap: '8px',
        boxShadow: '0 5px 0 #111, 0 8px 20px rgba(0,0,0,0.9)',
        transition: 'box-shadow 0.08s, transform 0.08s',
        fontFamily: 'inherit',
      }}
      onMouseDown={(e) => {
        if (!disabled) {
          e.currentTarget.style.boxShadow = '0 1px 0 #111, 0 2px 8px rgba(0,0,0,0.9)'
          e.currentTarget.style.transform = 'translateY(4px)'
        }
      }}
      onMouseUp={(e) => {
        e.currentTarget.style.boxShadow = '0 5px 0 #111, 0 8px 20px rgba(0,0,0,0.9)'
        e.currentTarget.style.transform = 'translateY(0)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '0 5px 0 #111, 0 8px 20px rgba(0,0,0,0.9)'
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      {/* Left coin slot bar */}
      <div style={{
        width: '8px',
        background: '#0a0000',
        borderRadius: '2px',
        flexShrink: 0,
        position: 'relative',
      }}>
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '4px',
          height: '20px',
          background: '#1a0000',
          borderRadius: '2px',
        }} />
      </div>

      {/* Main panel: red border, black bg, stacked text */}
      <div style={{
        border: '3px solid #cc0000',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '10px 20px 6px',
        gap: 0,
        minWidth: '130px',
      }}>
        {isLoading ? (
          <div style={{
            color: '#cc0000',
            fontSize: '10px',
            letterSpacing: '0.1em',
            fontFamily: '"Press Start 2P", Impact, sans-serif',
            textAlign: 'center',
            padding: '16px 0',
            lineHeight: 1.8,
          }}>
            {label}
          </div>
        ) : (
          <>
            <div style={{
              color: '#cc0000',
              fontSize: '32px',
              fontFamily: 'Impact, "Arial Narrow", sans-serif',
              letterSpacing: '0.02em',
              lineHeight: 1,
              marginBottom: '8px',
            }}>
              25¢
            </div>

            {/* Divider */}
            <div style={{ width: '100%', height: '2px', background: '#cc0000', marginBottom: '8px' }} />

            <div style={{
              color: '#cc0000',
              fontSize: '11px',
              fontFamily: 'Impact, "Arial Narrow", sans-serif',
              letterSpacing: '0.12em',
              lineHeight: 1.2,
              textAlign: 'center',
            }}>
              INSERT COIN TO
            </div>
            <div style={{
              color: '#cc0000',
              fontSize: '40px',
              fontFamily: 'Impact, "Arial Narrow", sans-serif',
              letterSpacing: '0.05em',
              lineHeight: 1,
              marginBottom: '10px',
            }}>
              PLAY
            </div>

            {/* Bottom reject strip */}
            <div style={{
              border: '1px solid #550000',
              width: '100%',
              textAlign: 'center',
              padding: '2px 0',
            }}>
              <span style={{
                color: '#550000',
                fontSize: '7px',
                fontFamily: 'Impact, "Arial Narrow", sans-serif',
                letterSpacing: '0.15em',
              }}>
                PUSH TO REJECT
              </span>
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
