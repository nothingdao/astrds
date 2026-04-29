// src/components/common/Header.tsx
import React, { useCallback } from 'react'
import { MessageSquare, User, Trophy, Coins, Pickaxe, HelpCircle, LucideIcon } from 'lucide-react'
import { useOverlayStore } from '@/stores/overlayStore'
import { useStateMachine, selectMachineState } from '@/stores/stateMachine'
import { Overlay } from '@/types/overlay'
import { MachineState } from '@/types/machine'
import WalletDropdown from './WalletDropdown'
import { Kbd } from '@/components/ui/kbd'
import AudioWidget from './AudioWidget'
import ThemeToggle from '@/components/theme/ThemeToggle'

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
      [Overlay.ASTRDS, Overlay.LEADERBOARD, Overlay.SPACE].includes(overlayType))

  return (
    <button
      onClick={handleClick}
      disabled={isDisabled}
      title={`${label} [${shortcut.toUpperCase()}]${isDisabled ? ' (Unavailable during gameplay)' : ''}`}
      className={`btn-grain h-10 px-4 flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider transition-colors
        border border-foreground outline outline-1 outline-offset-2 outline-foreground disabled:border-muted-foreground disabled:outline-muted-foreground
        focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background
        ${isDisabled
          ? 'bg-muted text-muted-foreground cursor-not-allowed'
          : isSelected
            ? 'bg-primary text-primary-foreground shadow-[var(--shadow-accent-glow)] [.theme-light_&]:bg-card [.theme-light_&]:text-card-foreground'
            : 'bg-primary text-primary-foreground hover:bg-card hover:text-card-foreground [.theme-light_&]:bg-card [.theme-light_&]:text-card-foreground [.theme-light_&]:hover:bg-primary [.theme-light_&]:hover:text-primary-foreground'
        }`}
    >
      <Icon size={13} />
      <span className='hidden md:inline'>{label}</span>
    </button>
  )
}

const Header: React.FC = () => {
  const headerButtons: Array<HeaderButtonProps & { key: string }> = [
    { key: 'astrds',      icon: Coins,        label: 'ASTRDS',      overlayType: Overlay.ASTRDS,      shortcut: 't' },
    { key: 'chat',        icon: MessageSquare,label: 'Chat',        overlayType: Overlay.CHAT,        shortcut: 'f' },
    { key: 'leaderboard', icon: Trophy,       label: 'Leaderboard', overlayType: Overlay.LEADERBOARD, shortcut: 'l' },
    { key: 'account',     icon: User,         label: 'Account',     overlayType: Overlay.ACCOUNT,     shortcut: 'a' },
    { key: 'mining',      icon: Pickaxe,      label: 'Mining',      overlayType: Overlay.MINING,      shortcut: 'm' },
    { key: 'help',        icon: HelpCircle,   label: 'Help',        overlayType: Overlay.HELP,        shortcut: '?' },
  ]

  return (
    <header className='fixed top-0 w-full z-50 border-b border-border px-4 py-3'>
      {/* Nav centered, wallet pinned right */}
      <div className='relative flex items-center justify-center'>
        {/* Audio widget — left */}
        <div className='absolute left-0'>
          <AudioWidget />
        </div>

        {/* Nav buttons — center */}
        <div className='flex items-center gap-4'>
          {headerButtons.map(({ key, ...props }) => (
            <HeaderButton key={key} {...props} />
          ))}
        </div>

        {/* Wallet — right */}
        <div className='absolute right-0 flex items-center gap-2'>
          <ThemeToggle />
          <WalletDropdown />
        </div>
      </div>
    </header>
  )
}

export default Header
