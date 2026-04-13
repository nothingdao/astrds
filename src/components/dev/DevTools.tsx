// src/components/dev/DevTools.tsx
// Dev-only helper for testing the Tokens in Space feature.
// Only rendered when import.meta.env.DEV is true.
import React, { useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useAction } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { TEST_TOKENS } from '../../constants/testTokens'

const DevTools: React.FC = () => {
  const wallet = useWallet()
  const mintTestToken = useAction(api.devTools.mintTestToken)

  const [selectedIndex, setSelectedIndex] = useState(0)
  const [amount, setAmount] = useState('10000')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  if (!import.meta.env.DEV) return null
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className='fixed bottom-4 left-4 z-[100] bg-yellow-400/20 border border-yellow-400/40 text-yellow-400 font-mono text-[10px] px-2 py-1 hover:bg-yellow-400/30 transition-colors'
      >
        DEV
      </button>
    )
  }

  const selected = TEST_TOKENS[selectedIndex]

  const handleMint = async () => {
    if (!wallet.publicKey || !selected) return
    setLoading(true)
    setStatus('Minting...')
    try {
      const result = await mintTestToken({
        playerPublicKey: wallet.publicKey.toString(),
        amount: parseInt(amount),
        decimals: selected.decimals,
        tokenDir: selected.dir,
        tokenName: selected.name,
        tokenSymbol: selected.symbol,
      })
      setStatus(`Minted ${result.amount} $${result.symbol}! Mint: ${result.mintAddress.slice(0, 8)}...`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setStatus(`Error: ${msg}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className='fixed bottom-4 left-4 z-[100] bg-black border border-yellow-400/40 p-3 space-y-2 font-mono text-xs w-72'>
      <div className='flex items-center justify-between'>
        <span className='text-yellow-400 uppercase tracking-wider text-[10px]'>Dev Tools</span>
        <button onClick={() => setOpen(false)} className='text-white/30 hover:text-white'>✕</button>
      </div>

      <div>
        <div className='text-white/40 text-[10px] mb-1'>Mint Test Token (Token-2022 + metadata)</div>

        <select
          value={selectedIndex}
          onChange={(e) => setSelectedIndex(Number(e.target.value))}
          className='w-full bg-black border border-white/15 text-white px-2 py-1 text-xs focus:outline-none focus:border-yellow-400/60 mb-2'
        >
          {TEST_TOKENS.map((t, i) => (
            <option key={t.dir} value={i}>
              ${t.symbol} — {t.name}
            </option>
          ))}
        </select>

        <div className='flex gap-2'>
          <input
            type='number'
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className='flex-1 bg-black/50 border border-white/15 text-white px-2 py-1 text-xs focus:outline-none focus:border-yellow-400/60'
            placeholder='Amount'
          />
          <button
            onClick={handleMint}
            disabled={loading || !wallet.connected}
            className='bg-yellow-400/20 border border-yellow-400/40 text-yellow-400 px-3 py-1 hover:bg-yellow-400/30 transition-colors disabled:opacity-40 whitespace-nowrap'
          >
            {loading ? '...' : 'Mint'}
          </button>
        </div>
      </div>

      {status && (
        <div className='text-[10px] text-white/50 break-all'>{status}</div>
      )}
    </div>
  )
}

export default DevTools
