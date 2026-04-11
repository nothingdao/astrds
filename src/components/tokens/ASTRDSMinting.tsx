import React, { useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useAction } from 'convex/react'
import { api } from '../../../convex/_generated/api'

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
      const result = await mintTokens({
        playerPublicKey: publicKey.toString(),
        tokenCount,
      })
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
    <div className='mb-8 space-y-4'>
      <div className='text-lg'>
        <span className='text-game-blue'>Tokens collected:</span> {tokenCount} $ASTRD
      </div>

      <button
        onClick={handleClaim}
        disabled={status.loading || !publicKey || !!status.signature}
        className={`w-full px-4 py-2 bg-game-blue text-black
          ${status.loading || !publicKey || status.signature
            ? 'opacity-50 cursor-not-allowed'
            : 'hover:bg-white'
          }`}
      >
        {!publicKey
          ? 'Connect wallet to claim'
          : status.loading
            ? 'Minting...'
            : status.signature
              ? 'Claimed!'
              : `Claim ${tokenCount} $ASTRD`}
      </button>

      {status.error && (
        <div className='text-red-500 text-sm'>{status.error}</div>
      )}

      {status.signature && (
        <div className='text-green-500 text-sm'>
          <a
            href={`https://explorer.solana.com/tx/${status.signature}?cluster=devnet`}
            target='_blank'
            rel='noopener noreferrer'
            className='text-game-blue hover:underline'
          >
            View on Solana Explorer
          </a>
        </div>
      )}
    </div>
  )
}

export default ASTRDSMinting
