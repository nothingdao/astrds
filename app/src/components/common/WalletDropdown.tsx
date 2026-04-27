// src/components/common/WalletDropdown.tsx
import React, { useState, useRef, useEffect } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useWalletModal } from '@solana/wallet-adapter-react-ui'
import { Copy, ExternalLink, LogOut, Wallet } from 'lucide-react'

const WalletDropdown: React.FC = () => {
  const { connected, publicKey, disconnect } = useWallet()
  const { setVisible } = useWalletModal()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const address = publicKey?.toString() ?? ''
  const short = address ? `${address.slice(0, 4)}...${address.slice(-4)}` : ''

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const copyAddress = () => {
    if (address) navigator.clipboard.writeText(address)
    setOpen(false)
  }

  if (!connected) {
    return (
      <button
        onClick={() => setVisible(true)}
        className='btn-grain h-8 px-4 bg-primary text-primary-foreground font-mono text-xs uppercase tracking-wider hover:bg-card hover:text-card-foreground transition-colors flex items-center gap-2'
      >
        <Wallet size={12} />
        Connect
      </button>
    )
  }

  return (
    <div ref={ref} className='relative'>
      <button
        onClick={() => setOpen(!open)}
        className='btn-grain h-8 px-4 bg-primary text-primary-foreground font-mono text-xs uppercase tracking-wider hover:bg-card hover:text-card-foreground transition-colors flex items-center gap-2'
      >
        <span className='w-1.5 h-1.5 rounded-full bg-[var(--text-success)] shrink-0' />
        {short}
      </button>

      {open && (
        <div className='absolute right-0 top-full mt-1 bg-card text-card-foreground border border-edge-accent min-w-[190px] z-[100] shadow-xl'>
          {/* Address header */}
          <div className='px-3 py-2 border-b border-border'>
            <div className='font-mono text-[9px] text-muted-foreground uppercase tracking-[0.2em]'>Connected</div>
            <div className='font-mono text-xs text-tx-secondary mt-0.5 break-all'>{short}</div>
          </div>

          <button
            onClick={copyAddress}
            className='w-full px-3 py-2 flex items-center gap-2 font-mono text-xs text-tx-secondary hover:bg-surface-tinted hover:text-foreground transition-colors text-left'
          >
            <Copy size={11} />
            Copy Address
          </button>

          <a
            href={`https://orbmarkets.io/address/${address}?cluster=devnet`}
            target='_blank'
            rel='noopener noreferrer'
            onClick={() => setOpen(false)}
            className='w-full px-3 py-2 flex items-center gap-2 font-mono text-xs text-tx-secondary hover:bg-surface-tinted hover:text-foreground transition-colors'
          >
            <ExternalLink size={11} />
            View on Orb
          </a>

          <div className='border-t border-border'>
            <button
              onClick={() => { disconnect(); setOpen(false) }}
              className='w-full px-3 py-2 flex items-center gap-2 font-mono text-xs text-tx-danger hover:bg-surface-subtle transition-colors text-left'
            >
              <LogOut size={11} />
              Disconnect
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default WalletDropdown
