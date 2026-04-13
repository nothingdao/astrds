// src/components/overlay/OverlayManager.tsx
import React, { useEffect } from 'react'
import { useOverlayStore } from '@/stores/overlayStore'
import { useStateMachine } from '@/stores/stateMachine'
import { Overlay } from '@/types/overlay'
import { MachineState } from '@/types/machine'
import { Kbd } from '@/components/ui/kbd'
import SoundSettings from '../sound/SoundSettings'
import AccountScreen from '@/screens/account/AccountScreen'
import FullChat from '@/components/chat/FullChat'
import LeaderboardScreen from '@/screens/leaderboard/LeaderboardScreen'
import TokenomicsScreen from '@/screens/tokenomics/TokenomicsScreen'
import KeyboardShortcutsOverlay from '@/components/common/KeyboardShortcutsOverlay'

const OVERLAY_META: Record<Overlay, { title: string; maxWidth: string }> = {
  [Overlay.NONE]:        { title: '',                   maxWidth: 'max-w-4xl' },
  [Overlay.SOUND]:       { title: 'Sound Settings',     maxWidth: 'max-w-lg'  },
  [Overlay.ACCOUNT]:     { title: 'Account',            maxWidth: 'max-w-5xl' },
  [Overlay.CHAT]:        { title: 'Game Chat',          maxWidth: 'max-w-2xl' },
  [Overlay.LEADERBOARD]: { title: 'Leaderboard',        maxWidth: 'max-w-4xl' },
  [Overlay.TOKENOMICS]:  { title: 'Tokenomics',         maxWidth: 'max-w-4xl' },
  [Overlay.SHORTCUTS]:   { title: 'Keyboard Shortcuts', maxWidth: 'max-w-lg'  },
}

interface OverlayContentProps {
  type: Overlay
  onClose: () => void
}

const OverlayContent: React.FC<OverlayContentProps> = ({ type, onClose }) => {
  const setState = useStateMachine((state) => state.setState)

  switch (type) {
    case Overlay.SOUND:
      return <SoundSettings isOpen={true} onClose={onClose} />

    case Overlay.ACCOUNT:
      return <AccountScreen onClose={onClose} />

    case Overlay.CHAT:
      return (
        <FullChat
          onClose={onClose}
          onPlayClick={() => {
            onClose()
            setState(MachineState.READY_TO_PLAY)
          }}
        />
      )

    case Overlay.LEADERBOARD:
      return (
        <LeaderboardScreen
          isOverlay={true}
          onClose={onClose}
          onPlayAgain={() => {
            onClose()
            setState(MachineState.READY_TO_PLAY)
          }}
        />
      )

    case Overlay.TOKENOMICS:
      return <TokenomicsScreen onClose={onClose} />

    case Overlay.SHORTCUTS:
      return <KeyboardShortcutsOverlay onClose={onClose} />

    default:
      return null
  }
}

const OverlayManager: React.FC = () => {
  const activeOverlay = useOverlayStore((state) => state.activeOverlay)
  const closeOverlay = useOverlayStore((state) => state.closeOverlay)

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activeOverlay) closeOverlay()
    }
    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [activeOverlay, closeOverlay])

  if (!activeOverlay) return null

  const { title, maxWidth } = OVERLAY_META[activeOverlay]

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center p-4'>
      {/* Backdrop */}
      <div
        className='absolute inset-0 bg-black/80'
        onClick={closeOverlay}
      />

      {/* Panel */}
      <div className={`relative z-10 w-full ${maxWidth} max-h-[88vh] bg-black border border-white/15 flex flex-col shadow-[0_0_40px_rgba(0,0,0,0.8)]`}>
        {/* Header — single close button lives here */}
        <div className='flex items-center justify-between px-5 py-3 border-b border-white/10 shrink-0'>
          <span className='font-mono text-[10px] uppercase tracking-[0.25em] text-white/40'>
            {title}
          </span>
          <button
            onClick={closeOverlay}
            className='flex items-center gap-1.5 font-mono text-[10px] text-white/30 hover:text-white transition-colors'
            aria-label='Close'
          >
            close <Kbd>Esc</Kbd>
          </button>
        </div>

        {/* Scrollable content */}
        <div className='flex-1 overflow-y-auto min-h-0'>
          <OverlayContent type={activeOverlay} onClose={closeOverlay} />
        </div>
      </div>
    </div>
  )
}

export default OverlayManager

export const useOverlayStatus = () => {
  const activeOverlay = useOverlayStore((state) => state.activeOverlay)
  return {
    isOverlayActive: !!activeOverlay,
    currentOverlay: activeOverlay,
  }
}
