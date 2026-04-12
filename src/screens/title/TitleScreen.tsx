import React, { memo, useCallback } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useStateMachine } from '@/stores/stateMachine'
import ScreenContainer from '@/components/common/ScreenContainer'
import GameTitle from '@/components/common/GameTitle'
import ActionButtons from '@/components/common/ActionButtons'
import { QuarterButton } from '@/components/common/Buttons'
import PaymentModal from './PaymentModal'
import { useAuth } from '@/hooks/useAuth'
import { MachineState } from '@/types/machine'

const TitleScreen: React.FC = () => {
  const wallet = useWallet()
  const [isPaymentModalVisible, setIsPaymentModalVisible] = React.useState(false)
  const [selectedPaymentOption, setSelectedPaymentOption] = React.useState(null)
  const { isVerifying, error, verifyWallet } = useAuth()
  const resetEngine = useEngineStore((state) => state.resetEngine)
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
      setIsPaymentModalVisible(false);
      const success = await verifyWallet(selectedPaymentOption);
      if (success) {
        await handleQuarterInsert();
      }
    } catch (err) {
      console.error('Payment failed:', err);
    }
  }, [verifyWallet, handleQuarterInsert, selectedPaymentOption]);

  return (
    <ScreenContainer>
      <GameTitle />
      <ActionButtons>
        <QuarterButton
          onClick={handleQuarterClick}
          disabled={!wallet.connected || isVerifying}
          loading={isVerifying}
        />
      </ActionButtons>

      {!wallet.connected && (
        <p className="text-gray-400 mt-4 text-center">
          Connect your wallet to play
        </p>
      )}

      {error && <p className="text-red-500 mt-4 text-center">{error}</p>}

      {isPaymentModalVisible && (
        <PaymentModal
          isVisible={isPaymentModalVisible}
          selectedOption={selectedPaymentOption}
          onSelect={setSelectedPaymentOption}
          onSubmit={handlePaymentSubmit}
          onClose={() => setIsPaymentModalVisible(false)}
          isVerifying={isVerifying}
          error={error}
        />
      )}
    </ScreenContainer>
  )
}

export default memo(TitleScreen)
