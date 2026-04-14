// src/components/dev/DevTools.tsx
import React, { useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useAction, useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { TEST_TOKENS } from '../../constants/testTokens'
import { useEngineStore } from '@/stores/engineStore'

const DevTools: React.FC = () => {
  const wallet = useWallet()
  const mintTestToken = useAction(api.devTools.mintTestToken)
  const seedSpaceDeposits = useMutation(api.devMutations.seedSpaceDeposits)
  const clearDevDeposits = useMutation(api.devMutations.clearDevDeposits)
  const devFastSpawn = useEngineStore((s) => s.devFastSpawn)
  const setDevFastSpawn = useEngineStore((s) => s.setDevFastSpawn)

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

  const handleMintOne = async () => {
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
      setStatus(`✓ ${result.amount} $${result.symbol} — ${result.mintAddress.slice(0, 8)}...`)
    } catch (err: unknown) {
      setStatus(`✗ ${err instanceof Error ? err.message : 'Error'}`)
    } finally {
      setLoading(false)
    }
  }

  const handleMintAll = async () => {
    if (!wallet.publicKey) return
    setLoading(true)
    const results: string[] = []
    for (const token of TEST_TOKENS) {
      setStatus(`Minting ${token.symbol}...`)
      try {
        await mintTestToken({
          playerPublicKey: wallet.publicKey.toString(),
          amount: parseInt(amount),
          decimals: token.decimals,
          tokenDir: token.dir,
          tokenName: token.name,
          tokenSymbol: token.symbol,
        })
        results.push(`✓ ${token.symbol}`)
      } catch {
        results.push(`✗ ${token.symbol}`)
      }
    }
    setStatus(results.join('  '))
    setLoading(false)
  }

  const handleSeedSpace = async () => {
    if (!wallet.publicKey) return
    setLoading(true)
    setStatus('Seeding space pools...')
    try {
      const result = await seedSpaceDeposits({ walletAddress: wallet.publicKey.toString() })
      setStatus(`✓ Seeded: ${result.inserted.join(', ') || 'none (already active)'}`)
    } catch (err: unknown) {
      setStatus(`✗ ${err instanceof Error ? err.message : 'Error'}`)
    } finally {
      setLoading(false)
    }
  }

  const handleClearSpace = async () => {
    setLoading(true)
    setStatus('Clearing dev deposits...')
    try {
      const result = await clearDevDeposits({})
      setStatus(`✓ Deleted ${result.deleted} dev deposits`)
    } catch (err: unknown) {
      setStatus(`✗ ${err instanceof Error ? err.message : 'Error'}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className='fixed bottom-4 left-4 z-[100] bg-black border border-yellow-400/40 p-3 space-y-3 font-mono text-xs w-80'>
      <div className='flex items-center justify-between'>
        <span className='text-yellow-400 uppercase tracking-wider text-[10px]'>Dev Tools</span>
        <button onClick={() => setOpen(false)} className='text-white/30 hover:text-white'>✕</button>
      </div>

      {/* Mint one token */}
      <div>
        <div className='text-white/40 text-[10px] mb-1'>Mint Test Token</div>
        <select
          value={selectedIndex}
          onChange={(e) => setSelectedIndex(Number(e.target.value))}
          className='w-full bg-black border border-white/15 text-white px-2 py-1 text-xs focus:outline-none focus:border-yellow-400/60 mb-2'
        >
          {TEST_TOKENS.map((t, i) => (
            <option key={t.dir} value={i}>${t.symbol} — {t.name}</option>
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
            onClick={handleMintOne}
            disabled={loading || !wallet.connected}
            className='bg-yellow-400/20 border border-yellow-400/40 text-yellow-400 px-3 py-1 hover:bg-yellow-400/30 transition-colors disabled:opacity-40'
          >
            {loading ? '...' : 'Mint'}
          </button>
        </div>
      </div>

      {/* Mint all */}
      <div className='flex gap-2'>
        <button
          onClick={handleMintAll}
          disabled={loading || !wallet.connected}
          className='flex-1 bg-yellow-400/20 border border-yellow-400/40 text-yellow-400 px-2 py-1 hover:bg-yellow-400/30 transition-colors disabled:opacity-40 text-[10px] uppercase tracking-wider'
        >
          Mint All ({TEST_TOKENS.length})
        </button>
      </div>

      {/* Space pool controls */}
      <div>
        <div className='text-white/40 text-[10px] mb-1'>Space Pools (dev deposits — no on-chain tx)</div>
        <div className='flex gap-2'>
          <button
            onClick={handleSeedSpace}
            disabled={loading || !wallet.connected}
            className='flex-1 bg-purple-500/20 border border-purple-500/40 text-purple-400 px-2 py-1 hover:bg-purple-500/30 transition-colors disabled:opacity-40 text-[10px] uppercase tracking-wider'
          >
            Seed All Pools
          </button>
          <button
            onClick={handleClearSpace}
            disabled={loading}
            className='flex-1 bg-red-500/20 border border-red-500/40 text-red-400 px-2 py-1 hover:bg-red-500/30 transition-colors disabled:opacity-40 text-[10px] uppercase tracking-wider'
          >
            Clear Dev
          </button>
        </div>
      </div>

      {/* Fast spawn toggle */}
      <div className='flex items-center justify-between border border-white/10 px-2 py-1.5'>
        <span className='text-white/50 text-[10px] uppercase tracking-wider'>Fast Spawn (space tokens)</span>
        <button
          onClick={() => setDevFastSpawn(!devFastSpawn)}
          className={`text-[10px] px-2 py-0.5 border transition-colors ${
            devFastSpawn
              ? 'bg-green-500/30 border-green-500/50 text-green-400'
              : 'bg-white/10 border-white/20 text-white/40'
          }`}
        >
          {devFastSpawn ? 'ON' : 'OFF'}
        </button>
      </div>

      {status && (
        <div className='text-[10px] text-white/50 break-all border-t border-white/10 pt-2'>{status}</div>
      )}
    </div>
  )
}

export default DevTools
