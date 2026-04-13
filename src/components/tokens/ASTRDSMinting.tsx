import React, { useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useAction } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const ASTRDSMinting: React.FC<{ tokenCount: number }> = ({ tokenCount }) => {
  const { publicKey } = useWallet()
  const mintTokens = useAction(api.tokens.mintTokens)
  const [status, setStatus] = useState<{
    loading: boolean
    error: string | null
    signature: string | null
  }>({ loading: false, error: null, signature: null })

  if (tokenCount <= 0) return null

  const handleClaim = async () => {
    if (!publicKey) return
    setStatus({ loading: true, error: null, signature: null })
    try {
      const result = await mintTokens({ playerPublicKey: publicKey.toString(), tokenCount })
      setStatus({ loading: false, error: null, signature: result.signature })
    } catch (err) {
      setStatus({
        loading: false,
        error: err instanceof Error ? err.message : 'Minting failed',
        signature: null,
      })
    }
  }

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-center gap-3'>
        <span className='text-gray-400 text-sm'>Tokens collected</span>
        <Badge className='bg-game-blue/10 text-game-blue border-game-blue/40 font-mono text-base px-3 py-1'>
          {tokenCount} $ASTRDS
        </Badge>
      </div>

      <Button
        variant={status.signature ? 'ghost' : 'quarter'}
        size='lg'
        onClick={handleClaim}
        disabled={status.loading || !publicKey || !!status.signature}
        className='w-full'
      >
        {!publicKey
          ? 'Connect wallet to claim'
          : status.loading
            ? 'Minting...'
            : status.signature
              ? 'Claimed!'
              : `Claim ${tokenCount} $ASTRDS`}
      </Button>

      {status.error && (
        <p className='text-game-red text-sm text-center'>{status.error}</p>
      )}

      {status.signature && (
        <a
          href={`https://orbmarkets.io/tx/${status.signature}?cluster=devnet`}
          target='_blank'
          rel='noopener noreferrer'
          className='block text-center text-xs text-game-blue hover:underline'
        >
          View on Helius Orb ⇗
        </a>
      )}
    </div>
  )
}

export default ASTRDSMinting
