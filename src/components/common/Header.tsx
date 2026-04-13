// src/components/common/Header.tsx
import React, { useCallback } from 'react'
import { MessageSquare, User, Trophy, Coins, LucideIcon } from 'lucide-react'
import { useOverlayStore } from '@/stores/overlayStore'
import { useStateMachine, selectMachineState } from '@/stores/stateMachine'
import { Overlay } from '@/types/overlay'
import { MachineState } from '@/types/machine'
import WalletDropdown from './WalletDropdown'
import { Kbd } from '@/components/ui/kbd'
import AudioWidget from './AudioWidget'

interface HeaderButtonProps {
  icon: LucideIcon
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
  disabled = false,
}) => {
  const { isOverlayActive, openOverlay } = useOverlayStore()
  const currentGameState = useStateMachine(selectMachineState)
  const isSelected = isOverlayActive(overlayType)

  const handleClick = useCallback(() => {
    if (!disabled) openOverlay(overlayType)
  }, [disabled, openOverlay, overlayType])

  const isDisabled =
    disabled ||
    (currentGameState === MachineState.PLAYING &&
      !isSelected &&
      [Overlay.TOKENOMICS, Overlay.LEADERBOARD].includes(overlayType))

  return (
    <button
      onClick={handleClick}
      disabled={isDisabled}
      title={`${label} [${shortcut.toUpperCase()}]${isDisabled ? ' (Unavailable during gameplay)' : ''}`}
      className={`btn-grain h-8 px-4 flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider transition-colors
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-1 focus-visible:ring-offset-black
        ${isDisabled
          ? 'bg-white/10 text-white/20 cursor-not-allowed'
          : isSelected
            ? 'bg-white text-black'
            : 'bg-game-blue text-black hover:bg-white'
        }`}
    >
      <Icon size={13} />
      <span className='hidden md:inline'>{label}</span>
    </button>
  )
}

const Header: React.FC = () => {
  const openOverlay = useOverlayStore((state) => state.openOverlay)

  const headerButtons: Array<HeaderButtonProps & { key: string }> = [
    { key: 'tokenomics', icon: Coins,         label: 'Tokenomics',  overlayType: Overlay.TOKENOMICS,  shortcut: 't' },
    { key: 'chat',       icon: MessageSquare, label: 'Chat',        overlayType: Overlay.CHAT,        shortcut: 'f' },
    { key: 'leaderboard',icon: Trophy,        label: 'Leaderboard', overlayType: Overlay.LEADERBOARD, shortcut: 'l' },
    { key: 'account',    icon: User,          label: 'Account',     overlayType: Overlay.ACCOUNT,     shortcut: 'a' },
  ]

  return (
    <header className='fixed top-0 w-full z-50 border-b border-white/10 px-4 py-3'>
      {/* Nav centered, wallet pinned right */}
      <div className='relative flex items-center justify-center'>
        {/* Audio widget — left */}
        <div className='absolute left-0'>
          <AudioWidget />
        </div>

        {/* Nav buttons — center */}
        <div className='flex items-center gap-2'>
          {headerButtons.map(({ key, ...props }) => (
            <HeaderButton key={key} {...props} />
          ))}
          <button
            onClick={() => openOverlay(Overlay.SHORTCUTS)}
            title='Keyboard shortcuts [?]'
            className='btn-grain h-8 w-8 flex items-center justify-center font-mono text-xs bg-white/10 text-white/50 hover:bg-white/20 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-1 focus-visible:ring-offset-black'
          >
            ?
          </button>
        </div>

        {/* Wallet — right */}
        <div className='absolute right-0'>
          <WalletDropdown />
        </div>
      </div>
    </header>
  )
}

export default Header
