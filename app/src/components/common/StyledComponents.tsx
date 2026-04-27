//src/components/common/StyledComponents.tsx
import React from 'react'

export const StyledWalletButton = ({ children }) => (
  <div
    className='[&>.wallet-adapter-button]:bg-transparent
                  [&>.wallet-adapter-button]:border-2 
                  [&>.wallet-adapter-button]:border-primary 
                  [&>.wallet-adapter-button]:text-primary 
                  [&>.wallet-adapter-button]:font-arcade 
                  [&>.wallet-adapter-button]:px-6 
                  [&>.wallet-adapter-button]:py-3 
                  [&>.wallet-adapter-button]:text-sm 
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

export const StartButton = ({ onClick, disabled, loading, children }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`bg-transparent border-2 border-[var(--text-success)] text-tx-success 
                font-arcade px-8 py-4 text-base cursor-pointer 
                transition-all duration-300 uppercase relative overflow-hidden
                hover:bg-[var(--text-success)] hover:text-primary-foreground hover:shadow-[var(--shadow-accent-glow)]
                disabled:bg-card disabled:border-border 
                disabled:text-muted-foreground disabled:cursor-not-allowed 
                disabled:hover:shadow-none
                ${loading ? 'pr-6' : ''}`}
  >
    {children}
    {loading && (
      <span
        className='absolute right-2 top-1/2 -translate-y-1/2 w-2 h-2 
                       bg-[var(--text-success)] rounded-full animate-[blink_1s_infinite]'
      />
    )}
  </button>
)

export const Controls = ({ children }) => (
  <div
    className='absolute top-5 left-1/2 -translate-x-1/2 z-10 
                  text-xs text-center leading-7 text-muted-foreground'
  >
    {children}
  </div>
)

export const GameOver = ({ score, onPlayAgain, loading }) => (
  <div
    className='bg-surface-overlay border-2 border-primary p-8 text-center 
                  max-w-lg animate-fadeIn'
  >
    <p className='text-destructive text-2xl mb-6'>Game Over!</p>
    <p className='text-lg mb-4'>
      {score > 0 ? `${score} Points!` : '0 points... So sad.'}
    </p>
    <StartButton
      onClick={onPlayAgain}
      disabled={loading}
      loading={loading}
    >
      {loading ? 'Inserting Quarter...' : 'Add A Quarter, Play Again'}
    </StartButton>
  </div>
)

export const Score = ({ children, className }) => (
  <span className={`text-sm md:text-base ${className || ''}`}>{children}</span>
)

export const AuthContainer = ({ title, children }) => (
  <div className='flex flex-col items-center justify-center min-h-screen bg-background relative z-10'>
    <h1
      className='text-4xl md:text-5xl mb-10 uppercase text-center leading-tight
                   text-foreground animate-[glow_1.5s_ease-in-out_infinite_alternate]
                   [text-shadow:var(--text-shadow-accent-glow)]'
    >
      {title}
    </h1>
    <div className='flex flex-col items-center gap-6 text-center'>
      {children}
    </div>
  </div>
)

export const GameHeader = ({ children }) => (
  <div className='fixed top-5 right-5 z-10 flex gap-5 items-center'>
    {children}
  </div>
)
