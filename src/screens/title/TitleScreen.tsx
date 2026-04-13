import React, { memo, useCallback } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useStateMachine } from '@/stores/stateMachine'
import { QuarterButton } from '@/components/common/Buttons'
import PaymentModal from './PaymentModal'
import { useAuth } from '@/hooks/useAuth'
import { MachineState } from '@/types/machine'

const TitleScreen: React.FC = () => {
  const wallet = useWallet()
  const [isPaymentModalVisible, setIsPaymentModalVisible] = React.useState(false)
  const [selectedPaymentOption, setSelectedPaymentOption] = React.useState<string | null>(null)
  const { isVerifying, error, verifyWallet } = useAuth()
  const gameState = useStateMachine()

  const handleQuarterInsert = useCallback(async () => {
    try {
      if (!wallet.connected) return
      await gameState.startTransition(MachineState.INITIAL, MachineState.READY_TO_PLAY)
    } catch (error) {
      console.error('Failed to start game:', error)
    }
  }, [wallet.connected, gameState])

  const handleQuarterClick = useCallback(() => {
    if (!wallet.connected) return
    setIsPaymentModalVisible(true)
  }, [wallet.connected])

  const handlePaymentSubmit = useCallback(async () => {
    try {
      setIsPaymentModalVisible(false)
      const success = await verifyWallet(selectedPaymentOption ?? undefined)
      if (success) {
        await handleQuarterInsert()
      }
    } catch (err) {
      console.error('Payment failed:', err)
    }
  }, [verifyWallet, handleQuarterInsert, selectedPaymentOption])

  return (
    <div className='fixed inset-0 overflow-hidden bg-black'>
      {/* Background image */}
      <div
        className='absolute inset-0 bg-cover bg-center bg-no-repeat'
        style={{ backgroundImage: "url('/assets/wojak-on-moon.png')" }}
      />

      {/* Gradient overlays */}
      <div className='absolute inset-0 bg-gradient-to-b from-black/80 via-black/30 to-black/95' />
      <div className='absolute inset-0 bg-gradient-to-t from-transparent via-transparent to-black/60' />

      {/* Scanlines */}
      <div
        className='absolute inset-0 pointer-events-none opacity-30'
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.4) 3px, rgba(0,0,0,0.4) 4px)',
        }}
      />

      {/* Perspective grid at bottom */}
      <div className='absolute bottom-0 left-0 right-0 h-64 overflow-hidden pointer-events-none'>
        <div
          className='absolute inset-0 opacity-20'
          style={{
            backgroundImage:
              'linear-gradient(rgba(77,193,249,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(77,193,249,0.6) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
            transform: 'perspective(400px) rotateX(70deg)',
            transformOrigin: 'bottom center',
          }}
        />
        <div className='absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/80' />
      </div>

      {/* Main layout */}
      <div className='absolute inset-0 flex flex-col items-center justify-between pt-28 pb-12 px-8'>

        {/* Top: studio credit */}
        <div className='text-center'>
          <p className='font-mono text-xs text-white/25 uppercase tracking-[0.5em]'>
            nothingdao presents
          </p>
        </div>

        {/* Center: title block */}
        <div className='text-center flex flex-col items-center gap-6'>
          <h1
            className='font-mono font-black uppercase leading-none text-white select-none'
            style={{
              fontSize: 'clamp(5rem, 18vw, 16rem)',
              letterSpacing: '0.05em',
              textShadow:
                '0 0 30px #4dc1f9, 0 0 60px #4dc1f9, 0 0 100px #4dc1f9, 0 0 200px rgba(77,193,249,0.4)',
              animation: 'glow 2s ease-in-out infinite alternate',
            }}
          >
            ASTRDS
          </h1>

          <p className='font-mono text-xl text-white/35 uppercase tracking-[0.7em]'>
            mine &nbsp;·&nbsp; survive &nbsp;·&nbsp; or die trying
          </p>

          {/* Flavor badges */}
          <div className='flex items-center gap-3 mt-2 flex-wrap justify-center'>
            {['Token-2022', 'Solana Devnet', 'Mine $ASTRDS'].map((badge) => (
              <span
                key={badge}
                className='font-mono text-[10px] text-game-blue/50 uppercase tracking-widest border border-game-blue/15 px-3 py-1'
              >
                {badge}
              </span>
            ))}
          </div>
        </div>

        {/* Bottom: CTA */}
        <div className='flex flex-col items-center gap-5'>
          {wallet.connected ? (
            <QuarterButton
              onClick={handleQuarterClick}
              disabled={isVerifying}
            >
              {isVerifying ? 'Verifying...' : undefined}
            </QuarterButton>
          ) : (
            <p className='font-mono text-game-blue/50 uppercase tracking-[0.4em] text-sm animate-pulse'>
              — Connect wallet to play —
            </p>
          )}

          {error && (
            <p className='font-mono text-red-400/80 text-xs text-center max-w-xs'>
              {error}
            </p>
          )}

          <p className='font-mono text-[10px] text-white/12 uppercase tracking-[0.4em]'>
            © 2025 nothingdao
          </p>
        </div>
      </div>

      {isPaymentModalVisible && (
        <PaymentModal
          isVisible={isPaymentModalVisible}
          selectedOption={selectedPaymentOption}
          onSelect={(v) => setSelectedPaymentOption(v)}
          onSubmit={handlePaymentSubmit}
          onClose={() => setIsPaymentModalVisible(false)}
          isVerifying={isVerifying}
          error={error}
        />
      )}
    </div>
  )
}

export default memo(TitleScreen)
