// src/screens/gameover/SpaceTokenClaim.tsx
// Shown at game over when the player collected space tokens during gameplay.
// Batch-claims them via Convex action (treasury → player wallet).
import React, { useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useAction } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { useSpaceTokenStore } from '@/stores/spaceTokenStore'
import { CheckCircle2, AlertCircle, Rocket } from 'lucide-react'

type ClaimState = 'idle' | 'claiming' | 'done' | 'error'

const SpaceTokenClaim: React.FC = () => {
  const wallet = useWallet()
  const collected = useSpaceTokenStore((s) => s.collectedThisSession)
  const resetSession = useSpaceTokenStore((s) => s.resetSession)
  const claimSpaceTokens = useAction(api.spaceDepositsActions.claimSpaceTokens)

  const [claimState, setClaimState] = useState<ClaimState>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [claimed, setClaimed] = useState<{ symbol: string; total: number }[]>([])

  if (collected.length === 0) return null

  const totalTypes = collected.length
  const totalPills = collected.reduce((sum, c) => sum + c.pillCount, 0)

  const handleClaim = async () => {
    if (!wallet.publicKey) return
    setClaimState('claiming')
    setErrorMsg('')

    const results: { symbol: string; total: number }[] = []

    try {
      for (const entry of collected) {
        const res = await claimSpaceTokens({
          depositId: entry.depositId,
          playerWalletAddress: wallet.publicKey.toString(),
          pillCount: entry.pillCount,
        })
        if (res.totalClaimed > 0) {
          results.push({ symbol: entry.symbol, total: res.totalClaimed / 10 ** (entry.decimals ?? 6) })
        }
      }
      setClaimed(results)
      resetSession()
      setClaimState('done')
    } catch (err: any) {
      setErrorMsg(err?.message ?? 'Claim failed')
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
            {collected.map((c) => {
              const perPillUi = c.tokensPerPill / 10 ** (c.decimals ?? 6)
              const totalUi = c.pillCount * perPillUi
              return (
                <div key={c.depositId} className='flex justify-between font-mono text-xs'>
                  <span className='text-white/60'>{c.symbol}</span>
                  <span className='text-purple-300'>
                    {c.pillCount} pill{c.pillCount !== 1 ? 's' : ''} ×{perPillUi.toLocaleString()} = {totalUi.toLocaleString()}
                  </span>
                </div>
              )
            })}
          </div>
          <button
            onClick={handleClaim}
            disabled={!wallet.connected}
            className='btn-grain w-full h-9 font-mono text-xs bg-purple-500 text-white hover:bg-purple-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
          >
            Claim {totalTypes} token type{totalTypes !== 1 ? 's' : ''} ({totalPills} pill{totalPills !== 1 ? 's' : ''})
          </button>
        </>
      )}

      {claimState === 'claiming' && (
        <p className='font-mono text-xs text-white/40 text-center py-2'>
          Claiming tokens from treasury...
        </p>
      )}

      {claimState === 'done' && (
        <div className='flex items-start gap-2'>
          <CheckCircle2 size={14} className='text-green-400 mt-0.5 shrink-0' />
          <div className='space-y-0.5'>
            {claimed.map((c) => (
              <p key={c.symbol} className='font-mono text-xs text-white/60'>
                {c.total.toLocaleString()} {c.symbol} sent to your wallet
              </p>
            ))}
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
