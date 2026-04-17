// src/screens/gameover/SpaceTokenClaim.tsx
// Shows all pending space token collections and lets the player claim them.
// Collections are written server-side at collection time and persist across
// sessions — closing the browser mid-game loses nothing.
import React, { useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useAction, useMutation, useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { Connection } from '@solana/web3.js'
import { CheckCircle2, AlertCircle, Rocket } from 'lucide-react'
import { RPC_ENDPOINT } from '@/lib/solana'
import { buildClaimTransaction, sendSignedTransaction } from '@/lib/spaceVault'

type ClaimState = 'idle' | 'claiming' | 'done' | 'error'

const SpaceTokenClaim: React.FC = () => {
  const wallet = useWallet()
  const walletAddress = wallet.publicKey?.toString()

  const pending = useQuery(
    api.spaceDeposits.getPendingCollectionsByWallet,
    walletAddress ? { playerWalletAddress: walletAddress } : 'skip'
  )
  const prepareClaims = useAction(api.spaceDepositsActions.prepareClaims)
  const finalizeClaim = useMutation(api.spaceDeposits.finalizeClaim)

  const [claimState, setClaimState] = useState<ClaimState>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [results, setResults] = useState<{ symbol: string; totalClaimed: number; decimals: number }[]>([])

  // Not connected or still loading
  if (!walletAddress || pending === undefined) return null
  // Nothing pending
  if (pending.length === 0 && claimState === 'idle') return null

  // Group pending by mint for display
  const byMint = new Map<string, typeof pending[number] & { totalAmount: number }>()
  for (const col of pending) {
    const key = col.mintAddress
    if (!byMint.has(key)) {
      byMint.set(key, { ...col, totalAmount: 0 })
    }
    byMint.get(key)!.totalAmount += col.amount
  }
  const grouped = [...byMint.values()]

  const handleClaim = async () => {
    if (!walletAddress || !wallet.publicKey || !wallet.signTransaction) return
    setClaimState('claiming')
    setErrorMsg('')
    try {
      const prepared = await prepareClaims({ playerWalletAddress: walletAddress })
      const connection = new Connection(RPC_ENDPOINT, 'confirmed')
      const claimed: { symbol: string; totalClaimed: number; decimals: number }[] = []

      for (const claim of prepared.claims) {
        const built = await buildClaimTransaction({
          connection,
          player: wallet.publicKey,
          claim,
        })
        const signed = await wallet.signTransaction(built.transaction)
        const txSignature = await sendSignedTransaction({
          connection,
          signedTransaction: signed,
          blockhash: built.blockhash,
          lastValidBlockHeight: built.lastValidBlockHeight,
        })

        await finalizeClaim({
          depositId: claim.depositId as any,
          collectionIds: claim.collectionIds as any,
          playerWalletAddress: walletAddress,
          mintAddress: claim.mintAddress,
          txSignature,
          amount: claim.totalAmount,
        })

        claimed.push({
          symbol: claim.symbol,
          totalClaimed: claim.totalAmount,
          decimals: claim.decimals,
        })
      }

      setResults(claimed)
      setClaimState('done')
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Claim failed')
      setClaimState('error')
    }
  }

  return (
    <div className='bg-purple-500/10 border border-purple-500/30 rounded-lg p-4 space-y-3'>
      <div className='flex items-center gap-2'>
        <Rocket size={14} className='text-purple-400' />
        <span className='font-mono text-xs text-purple-300 uppercase tracking-wider'>
          Space Tokens Collected
        </span>
      </div>

      {claimState === 'idle' && (
        <>
          <div className='space-y-1'>
            {grouped.map((g) => {
              const uiAmount = g.totalAmount / 10 ** g.decimals
              const pillCount = Math.round(g.totalAmount / g.tokensPerPill)
              const perPillUi = g.tokensPerPill / 10 ** g.decimals
              return (
                <div key={g.mintAddress} className='flex justify-between font-mono text-xs'>
                  <span className='text-white/60'>{g.symbol}</span>
                  <span className='text-purple-300'>
                    {pillCount} collected × {perPillUi.toLocaleString()} = {uiAmount.toLocaleString()}
                  </span>
                </div>
              )
            })}
          </div>
          <button
            onClick={handleClaim}
            disabled={!wallet.connected || grouped.length === 0}
            className='btn-grain w-full h-9 font-mono text-xs bg-purple-500 text-white hover:bg-purple-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
          >
            Claim all space tokens
          </button>
        </>
      )}

      {claimState === 'claiming' && (
        <p className='font-mono text-xs text-white/40 text-center py-2'>
          Claiming tokens from the vault...
        </p>
      )}

      {claimState === 'done' && (
        <div className='flex items-start gap-2'>
          <CheckCircle2 size={14} className='text-green-400 mt-0.5 shrink-0' />
          <div className='space-y-0.5'>
            {results.length > 0 ? results.map((r) => (
              <p key={r.symbol} className='font-mono text-xs text-white/60'>
                {(r.totalClaimed / 10 ** r.decimals).toLocaleString()} {r.symbol} sent to your wallet
              </p>
            )) : (
              <p className='font-mono text-xs text-white/60'>Nothing to claim right now.</p>
            )}
          </div>
        </div>
      )}

      {claimState === 'error' && (
        <div className='flex items-start gap-2'>
          <AlertCircle size={14} className='text-game-red mt-0.5 shrink-0' />
          <div>
            <p className='font-mono text-xs text-white/60'>{errorMsg}</p>
            <button
              onClick={() => setClaimState('idle')}
              className='font-mono text-xs text-game-blue hover:text-white transition-colors mt-1'
            >
              Try again
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default SpaceTokenClaim
