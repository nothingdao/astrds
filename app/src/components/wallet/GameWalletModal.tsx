// src/components/wallet/GameWalletModal.tsx
import React, { useCallback, useLayoutEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { WalletReadyState } from '@solana/wallet-adapter-base'
import type { Wallet } from '@solana/wallet-adapter-react'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletModalContext } from '@solana/wallet-adapter-react-ui'
import { X, ExternalLink } from 'lucide-react'

const GameWalletModal: React.FC<{ setVisible: (v: boolean) => void }> = ({ setVisible }) => {
  const { wallets, select } = useWallet()
  const [expanded, setExpanded] = useState(false)

  const [listedWallets, collapsedWallets] = useMemo(() => {
    const installed: Wallet[] = []
    const rest: Wallet[] = []
    for (const w of wallets) {
      if (w.readyState === WalletReadyState.Installed) installed.push(w)
      else rest.push(w)
    }
    return installed.length ? [installed, rest] : [rest, [] as Wallet[]]
  }, [wallets])

  const close = useCallback(() => setVisible(false), [setVisible])

  const handleSelect = useCallback((name: string) => {
    select(name as Parameters<typeof select>[0])
    close()
  }, [select, close])

  useLayoutEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close])

  const visibleWallets = expanded ? [...listedWallets, ...collapsedWallets] : listedWallets

  return createPortal(
    <div className='fixed inset-0 z-[1040] flex items-center justify-center'>
      <div className='absolute inset-0 bg-surface-overlay' onClick={close} />

      <div className='relative z-10 w-full max-w-xs bg-card text-card-foreground border border-border shadow-2xl'>

        {/* Header */}
        <div className='flex items-center justify-between px-5 py-3.5 border-b border-border'>
          <span className='font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground'>
            Connect Wallet
          </span>
          <button
            onClick={close}
            className='text-muted-foreground hover:text-foreground transition-colors'
            aria-label='Close'
          >
            <X size={13} />
          </button>
        </div>

        {/* Wallet list */}
        {visibleWallets.length > 0 ? (
          <>
            {visibleWallets.map((wallet) => (
              <button
                key={wallet.adapter.name}
                onClick={() => handleSelect(wallet.adapter.name)}
                className='w-full flex items-center gap-3 px-5 py-3 border-b border-border hover:bg-surface-subtle transition-colors text-left'
              >
                <img
                  src={wallet.adapter.icon}
                  alt={wallet.adapter.name}
                  className='w-5 h-5 rounded shrink-0'
                />
                <span className='font-mono text-xs text-foreground flex-1'>
                  {wallet.adapter.name}
                </span>
                {wallet.readyState === WalletReadyState.Installed && (
                  <span className='font-mono text-[9px] text-primary uppercase tracking-wider shrink-0'>
                    Detected
                  </span>
                )}
              </button>
            ))}

            {!expanded && collapsedWallets.length > 0 && (
              <button
                onClick={() => setExpanded(true)}
                className='w-full px-5 py-3 font-mono text-[10px] text-muted-foreground hover:text-foreground transition-colors text-left'
              >
                + {collapsedWallets.length} more option{collapsedWallets.length !== 1 ? 's' : ''}
              </button>
            )}
          </>
        ) : (
          <div className='px-5 py-10 text-center'>
            <p className='font-mono text-xs text-muted-foreground'>
              You'll need a Solana wallet to play
            </p>
            <a
              href='https://phantom.app'
              target='_blank'
              rel='noopener noreferrer'
              className='inline-flex items-center gap-1.5 mt-4 font-mono text-[10px] text-primary hover:text-foreground transition-colors'
            >
              Get Phantom <ExternalLink size={9} />
            </a>
          </div>
        )}

        {/* Footer hint */}
        <div className='px-5 py-3 border-t border-border'>
          <p className='font-mono text-[9px] text-tx-dim text-center uppercase tracking-widest'>
            Solana · Devnet
          </p>
        </div>
      </div>
    </div>,
    document.body
  )
}

const GameWalletModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [visible, setVisible] = useState(false)

  return (
    <WalletModalContext.Provider value={{ visible, setVisible }}>
      {children}
      {visible && <GameWalletModal setVisible={setVisible} />}
    </WalletModalContext.Provider>
  )
}

export default GameWalletModalProvider
