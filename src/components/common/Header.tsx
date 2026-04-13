// src/components/common/Header.tsx
import React, { useCallback } from 'react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { MessageSquare, User, Trophy, Coins, LucideIcon } from 'lucide-react'
import { StyledWalletButton } from './StyledComponents'
import { useOverlayStore } from '@/stores/overlayStore'
import { useStateMachine, selectMachineState } from '@/stores/stateMachine'
import { Overlay } from '@/types/overlay'
import { MachineState } from '@/types/machine'

interface HeaderButtonProps {
  icon: LucideIcon  // Changed this line to use LucideIcon type
  label: string
  overlayType: Overlay
  shortcut: string
  disabled?: boolean
}

const HeaderButton: React.FC<HeaderButtonProps> = ({
  icon: Icon,
  label,
  overlayType,
  shortcut,
  disabled = false
}) => {
  const { isOverlayActive, openOverlay } = useOverlayStore()
  const currentGameState = useStateMachine(selectMachineState)
  const isSelected = isOverlayActive(overlayType)

  const handleClick = useCallback(() => {
    if (!disabled) {
      openOverlay(overlayType)
    }
  }, [disabled, openOverlay, overlayType])

  const isDisabled = disabled || (
    currentGameState === MachineState.PLAYING &&
    !isSelected &&
    [Overlay.TOKENOMICS, Overlay.LEADERBOARD].includes(overlayType)
  )

  return (
    <button
      onClick={handleClick}
      disabled={isDisabled}
      className={`
        h-12 px-4 flex items-center justify-center gap-2 rounded-sm
        transition-colors duration-200
        ${isDisabled
          ? 'opacity-50 cursor-not-allowed border-2 border-gray-600 text-gray-600'
          : isSelected
            ? 'bg-game-blue text-black'
            : 'border-2 border-game-blue text-game-blue hover:bg-game-blue hover:text-black'
        }
      `}
      title={`${label} [${shortcut.toUpperCase()}]${isDisabled ? ' (Unavailable during gameplay)' : ''}`}
    >
      <Icon size={20} />
      <span className='hidden md:inline'>{label}</span>
    </button>
  )
}

const Header: React.FC = () => {
  // Updated the buttons array with proper typing
  const headerButtons: Array<HeaderButtonProps & { key: string }> = [
    {
      key: 'tokenomics',
      icon: Coins,
      label: 'Tokenomics',
      overlayType: Overlay.TOKENOMICS,
      shortcut: 't',
      disabled: false
    },
    {
      key: 'chat',
      icon: MessageSquare,
      label: 'Chat',
      overlayType: Overlay.CHAT,
      shortcut: 'f',
      disabled: false
    },
    {
      key: 'leaderboard',
      icon: Trophy,
      label: 'Leaderboard',
      overlayType: Overlay.LEADERBOARD,
      shortcut: 'l',
      disabled: false
    },
    {
      key: 'account',
      icon: User,
      label: 'Account',
      overlayType: Overlay.ACCOUNT,
      shortcut: 'a',
      disabled: false
    }
  ]

  return (
    <header className='fixed top-0 w-full z-50 border-b border-white/10 px-4 py-3'>
      <div className='max-w-7xl mx-auto flex justify-end items-center gap-4'>
        {headerButtons.map(({ key, ...buttonProps }) => (
          <HeaderButton
            key={key}
            {...buttonProps}
          />
        ))}
        <StyledWalletButton>
          <WalletMultiButton />
        </StyledWalletButton>
      </div>
    </header>
  )
}

export default Header
