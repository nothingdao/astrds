// src/components/account/TokenBurnPanel.tsx
// Lets a player burn token balances and close the associated token accounts
// to reclaim rent. Works for both TOKEN and TOKEN_2022 program accounts.
import React, { useState, useCallback } from 'react'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { PublicKey, Transaction } from '@solana/web3.js'
import {
  createBurnCheckedInstruction,
  createCloseAccountInstruction,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token'
import { Flame, RefreshCw, CheckSquare, Square } from 'lucide-react'
import { getWalletTokens, type WalletToken } from '@/utils/walletTokens'

const TokenBurnPanel: React.FC = () => {
  const { publicKey, signTransaction, signAllTransactions, connected } = useWallet()
  const { connection } = useConnection()

  const [tokens, setTokens] = useState<WalletToken[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [burning, setBurning] = useState(false)
  const [status, setStatus] = useState('')

  const loadTokens = useCallback(async () => {
    if (!publicKey) return
    setLoading(true)
    setSelected(new Set())
    setStatus('')
    try {
      const result = await getWalletTokens(publicKey.toString(), true)
      setTokens(result)
    } finally {
      setLoading(false)
    }
  }, [publicKey])

  const toggle = (accountAddress: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(accountAddress) ? next.delete(accountAddress) : next.add(accountAddress)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === tokens.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(tokens.map(t => t.accountAddress)))
    }
  }

  const handleBurnAndClose = async () => {
    if (!publicKey || !signTransaction || selected.size === 0) return
    setBurning(true)
    setStatus('')

    const targets = tokens.filter(t => selected.has(t.accountAddress))
    let succeeded = 0
    const errors: string[] = []

    try {
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed')

      // Build one transaction per account — isolates failures so a bad account
      // doesn't block the rest. Sign all upfront then broadcast sequentially.
      const txs = targets.map(token => {
        const accountPubkey = new PublicKey(token.accountAddress)
        const mintPubkey = new PublicKey(token.mintAddress)
        const tokenProgram = token.programId === 'TOKEN_2022' ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID
        const tx = new Transaction()
        tx.recentBlockhash = blockhash
        tx.feePayer = publicKey

        if (token.balance > 0) {
          tx.add(createBurnCheckedInstruction(
            accountPubkey, mintPubkey, publicKey,
            BigInt(token.balance), token.decimals, [], tokenProgram
          ))
        }
        tx.add(createCloseAccountInstruction(
          accountPubkey, publicKey, publicKey, [], tokenProgram
        ))
        return { tx, token }
      })

      // Sign all in one wallet prompt
      const signed = await (signAllTransactions
        ? signAllTransactions(txs.map(t => t.tx))
        : Promise.all(txs.map(t => signTransaction(t.tx))))

      for (let i = 0; i < signed.length; i++) {
        try {
          const sig = await connection.sendRawTransaction(signed[i].serialize())
          await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed')
          succeeded++
        } catch (err) {
          errors.push(`${targets[i].symbol}: ${err instanceof Error ? err.message : 'failed'}`)
        }
      }

      const msg = [`✓ Closed ${succeeded} account${succeeded !== 1 ? 's' : ''}`]
      if (errors.length) msg.push(`✗ ${errors.length} failed: ${errors.join(', ')}`)
      setStatus(msg.join(' · '))
      await loadTokens()
    } catch (err) {
      setStatus(`✗ ${err instanceof Error ? err.message : 'Transaction failed'}`)
    } finally {
      setBurning(false)
    }
  }

  if (!connected) return null

  return (
    <div className='bg-card border border-border rounded-lg p-6'>
      <div className='flex items-center justify-between mb-4'>
        <h2 className='font-mono text-xs text-primary uppercase tracking-widest flex items-center gap-2'>
          <Flame size={14} />
          Wallet Cleanup
        </h2>
        <button
          onClick={loadTokens}
          disabled={loading}
          className='flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40'
        >
          <RefreshCw size={10} className={loading ? 'animate-spin' : ''} />
          {tokens.length > 0 ? 'Refresh' : 'Load tokens'}
        </button>
      </div>

      {tokens.length === 0 && !loading && (
        <p className='font-mono text-[10px] text-tx-dim text-center py-4'>
          Load tokens to burn balances and close accounts.
        </p>
      )}

      {tokens.length > 0 && (
        <>
          <div className='flex items-center justify-between mb-2'>
            <button
              onClick={toggleAll}
              className='flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground hover:text-foreground transition-colors'
            >
              {selected.size === tokens.length
                ? <CheckSquare size={10} />
                : <Square size={10} />
              }
              {selected.size === tokens.length ? 'Deselect all' : 'Select all'}
            </button>
            <span className='font-mono text-[10px] text-tx-dim'>{tokens.length} accounts</span>
          </div>

          <div className='space-y-1 max-h-64 overflow-y-auto mb-3'>
            {tokens.map((token) => {
              const isSelected = selected.has(token.accountAddress)
              return (
                <button
                  key={token.accountAddress}
                  onClick={() => toggle(token.accountAddress)}
                  className={`w-full flex items-center gap-3 px-3 py-2 border transition-colors text-left ${
                    isSelected
                      ? 'border-destructive/40 bg-destructive/10'
                      : 'border-edge-subtle bg-surface-subtle hover:border-edge-subtle'
                  }`}
                >
                  <div className={`shrink-0 ${isSelected ? 'text-destructive' : 'text-tx-dim'}`}>
                    {isSelected ? <CheckSquare size={12} /> : <Square size={12} />}
                  </div>
                  {token.logoUri
                    ? <img src={token.logoUri} alt={token.symbol} className='w-5 h-5 rounded-full shrink-0' />
                    : <div className='w-5 h-5 rounded-full bg-surface-subtle shrink-0' />
                  }
                  <div className='flex-1 min-w-0'>
                    <span className='font-mono text-xs text-tx-secondary'>{token.symbol}</span>
                    <span className='font-mono text-[9px] text-tx-dim ml-2'>{token.name}</span>
                  </div>
                  <span className={`font-mono text-xs shrink-0 ${token.balance === 0 ? 'text-tx-dim' : 'text-tx-secondary'}`}>
                    {token.balance === 0 ? 'empty' : token.uiBalance.toLocaleString()}
                  </span>
                </button>
              )
            })}
          </div>

          <button
            onClick={handleBurnAndClose}
            disabled={burning || selected.size === 0}
            className='w-full flex items-center justify-center gap-2 bg-destructive/20 border border-destructive/40 text-destructive hover:bg-destructive/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed px-3 py-2 font-mono text-xs'
          >
            <Flame size={12} />
            {burning
              ? 'Burning...'
              : selected.size === 0
                ? 'Select accounts to burn'
                : `Burn & close ${selected.size} account${selected.size > 1 ? 's' : ''}`
            }
          </button>
        </>
      )}

      {status && (
        <p className={`font-mono text-[10px] mt-2 ${status.startsWith('✓') ? 'text-tx-success' : 'text-destructive'}`}>
          {status}
        </p>
      )}
    </div>
  )
}

export default TokenBurnPanel
