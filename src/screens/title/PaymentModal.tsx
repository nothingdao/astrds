// src/screens/title/PaymentModal.tsx
import React, { memo } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { Coins } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { FormProps } from '@/types/forms'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface PaymentOptionProps {
  selected: boolean
  onSelect: (paymentType: string) => void
  type: string
  amount: number
  symbol: string
  label: string
}

const PaymentOption = memo(({ selected, onSelect, type, amount, symbol, label }: PaymentOptionProps) => (
  <button
    onClick={() => onSelect(type)}
    className={`w-full p-4 border-2 transition-all duration-200 flex items-center justify-between
      ${selected
        ? 'border-game-blue bg-game-blue/10 text-white'
        : 'border-white/10 hover:border-game-blue/50 text-gray-400 hover:text-white'
      }`}
  >
    <div className='flex items-center gap-3'>
      <Coins size={20} className={selected ? 'text-game-blue' : 'text-gray-500'} />
      <div className='text-left'>
        <div className='font-mono'>{amount.toLocaleString()} {symbol}</div>
        <div className='text-xs opacity-60'>{label}</div>
      </div>
    </div>
    <div className={`w-4 h-4 border-2 transition-colors ${selected ? 'border-game-blue bg-game-blue' : 'border-gray-500'}`} />
  </button>
))

const PaymentModal = memo((props: FormProps) => {
  const { isVisible, selectedOption, onSelect, onSubmit, onClose, error } = props
  const wallet = useWallet()
  const { isVerifying: authVerifying } = useAuth()

  return (
    <Dialog open={isVisible} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className='bg-black border border-game-blue max-w-md'>
        <DialogHeader>
          <DialogTitle className='text-game-blue flex items-center gap-2 font-arcade'>
            <Coins size={20} />
            Insert Quarter
          </DialogTitle>
        </DialogHeader>

        <div className='space-y-4 my-4'>
          <PaymentOption
            type='SOL'
            amount={0.05}
            symbol='SOL'
            label='Pay with SOL'
            selected={selectedOption === 'SOL'}
            onSelect={onSelect}
          />
          <PaymentOption
            type='ASTRDS'
            amount={1000}
            symbol='ASTRDS'
            label='Pay with ASTRDS'
            selected={selectedOption === 'ASTRDS'}
            onSelect={onSelect}
          />
        </div>

        {error && <div className='text-game-red text-sm text-center mb-4'>{error}</div>}

        <div className='flex gap-4'>
          <Button
            className='flex-1'
            onClick={onSubmit}
            disabled={!wallet.connected || authVerifying || !selectedOption}
          >
            {!wallet.connected
              ? 'Connect Wallet'
              : authVerifying
                ? 'Verifying...'
                : !selectedOption
                  ? 'Select Payment'
                  : 'Pay'}
          </Button>
          <Button variant='ghost' onClick={onClose}>
            Cancel
          </Button>
        </div>

        <p className='text-center text-xs text-gray-500 mt-2'>
          {wallet.connected ? 'Choose your preferred payment method' : 'Connect your wallet to continue'}
        </p>
      </DialogContent>
    </Dialog>
  )
})

export default PaymentModal
