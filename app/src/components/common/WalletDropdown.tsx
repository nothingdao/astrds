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
        className='btn-grain h-8 px-4 bg-game-blue text-black font-mono text-xs uppercase tracking-wider hover:bg-white transition-colors flex items-center gap-2'
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
        className='btn-grain h-8 px-4 bg-game-blue text-black font-mono text-xs uppercase tracking-wider hover:bg-white transition-colors flex items-center gap-2'
      >
        <span className='w-1.5 h-1.5 rounded-full bg-green-400 shrink-0' />
        {short}
      </button>

      {open && (
        <div className='absolute right-0 top-full mt-1 bg-black border border-game-blue/30 min-w-[190px] z-[100] shadow-[0_0_20px_rgba(77,193,249,0.15)]'>
          {/* Address header */}
          <div className='px-3 py-2 border-b border-white/10'>
            <div className='font-mono text-[9px] text-white/30 uppercase tracking-[0.2em]'>Connected</div>
            <div className='font-mono text-xs text-white/60 mt-0.5 break-all'>{short}</div>
          </div>

          <button
            onClick={copyAddress}
            className='w-full px-3 py-2 flex items-center gap-2 font-mono text-xs text-white/60 hover:bg-game-blue/10 hover:text-white transition-colors text-left'
          >
            <Copy size={11} />
            Copy Address
          </button>

          <a
            href={`https://orbmarkets.io/address/${address}?cluster=devnet`}
            target='_blank'
            rel='noopener noreferrer'
            onClick={() => setOpen(false)}
            className='w-full px-3 py-2 flex items-center gap-2 font-mono text-xs text-white/60 hover:bg-game-blue/10 hover:text-white transition-colors'
          >
            <ExternalLink size={11} />
            View on Orb
          </a>

          <div className='border-t border-white/10'>
            <button
              onClick={() => { disconnect(); setOpen(false) }}
              className='w-full px-3 py-2 flex items-center gap-2 font-mono text-xs text-game-red/60 hover:bg-game-red/10 hover:text-game-red transition-colors text-left'
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
