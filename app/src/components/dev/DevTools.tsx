// src/components/dev/DevTools.tsx
// Dev-only overlay content — only rendered in import.meta.env.DEV builds.
import React, { useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useAction, useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { TEST_TOKENS } from '../../constants/testTokens'
import { useEngineStore } from '@/stores/engineStore'
import VaultHealthCheck from './VaultHealthCheck'

const DevTools: React.FC = () => {
  const wallet = useWallet()
  const mintTestToken = useAction(api.devTools.mintTestToken)
  const devFastSpawn = useEngineStore((s) => s.devFastSpawn)
  const setDevFastSpawn = useEngineStore((s) => s.setDevFastSpawn)
  const entities = useEngineStore((s) => s.entities)

  const handleSuicide = () => {
    const ship = entities.ship[0]
    if (ship) ship.destroy()
  }

  const [selectedIndex, setSelectedIndex] = useState(0)
  const [amount, setAmount] = useState('10000')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)

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

  return (
    <div className='p-6 space-y-6 font-mono text-xs'>

      {/* Mint tokens to wallet */}
      <div>
        <div className='font-mono text-[10px] text-tx-warning uppercase tracking-widest mb-3'>
          Mint Test Token to Wallet
        </div>
        <div className='text-muted-foreground text-[10px] mb-3'>
          Mints real devnet SPL tokens to your connected wallet. Use the Space overlay to deposit them into the game treasury.
        </div>
        <select
          value={selectedIndex}
          onChange={(e) => setSelectedIndex(Number(e.target.value))}
          className='w-full bg-background border border-edge-subtle text-foreground px-2 py-1.5 text-xs focus:outline-none focus:border-[var(--text-warning)]/60 mb-3'
        >
          {TEST_TOKENS.map((t, i) => (
            <option key={t.dir} value={i}>${t.symbol} — {t.name}</option>
          ))}
        </select>
        <div className='flex gap-2 mb-2'>
          <input
            type='number'
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className='flex-1 bg-surface-overlay border border-edge-subtle text-foreground px-2 py-1.5 text-xs focus:outline-none focus:border-[var(--text-warning)]/60'
            placeholder='Amount'
          />
          <button
            onClick={handleMintOne}
            disabled={loading || !wallet.connected}
            className='bg-[var(--text-warning)]/20 border border-[var(--text-warning)]/40 text-tx-warning px-4 py-1.5 hover:bg-[var(--text-warning)]/30 transition-colors disabled:opacity-40'
          >
            {loading ? '...' : 'Mint'}
          </button>
        </div>
        <button
          onClick={handleMintAll}
          disabled={loading || !wallet.connected}
          className='w-full bg-[var(--text-warning)]/10 border border-[var(--text-warning)]/30 text-tx-warning/70 px-2 py-1.5 hover:bg-[var(--text-warning)]/20 transition-colors disabled:opacity-40 text-[10px] uppercase tracking-wider'
        >
          Mint All ({TEST_TOKENS.length} tokens)
        </button>
      </div>

      {/* Gameplay controls */}
      <div>
        <div className='font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-3'>Gameplay</div>
        <div className='space-y-2'>
          <div className='flex items-center justify-between border border-border px-3 py-2'>
            <span className='text-tx-secondary text-[10px] uppercase tracking-wider'>Fast Token Spawn</span>
            <button
              onClick={() => setDevFastSpawn(!devFastSpawn)}
              className={`text-[10px] px-3 py-0.5 border transition-colors ${
                devFastSpawn
                  ? 'bg-[var(--text-success)]/30 border-[var(--text-success)]/50 text-tx-success'
                  : 'bg-surface-subtle border-edge-medium text-muted-foreground'
              }`}
            >
              {devFastSpawn ? 'ON' : 'OFF'}
            </button>
          </div>
          <button
            onClick={handleSuicide}
            disabled={!entities.ship[0]}
            className='w-full bg-destructive/20 border border-destructive/40 text-destructive px-2 py-2 hover:bg-destructive/30 transition-colors disabled:opacity-40 text-[10px] uppercase tracking-wider'
          >
            ☠ Kill Ship (trigger game over)
          </button>
        </div>
      </div>


      {/* Vault health check */}
      <div className='border-t border-border pt-4'>
        <VaultHealthCheck />
      </div>

      {status && (
        <div className='text-[10px] text-tx-secondary break-all border-t border-border pt-3'>{status}</div>
      )}
    </div>
  )
}

export default DevTools
