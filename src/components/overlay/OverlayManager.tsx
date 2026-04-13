// src/components/overlay/OverlayManager.tsx
import React, { useEffect } from 'react'
import { useOverlayStore } from '@/stores/overlayStore'
import { useStateMachine } from '@/stores/stateMachine'
import { Overlay } from '@/types/overlay'
import { MachineState } from '@/types/machine'
import SoundSettings from '../sound/SoundSettings'
import AccountScreen from '@/screens/account/AccountScreen'
import FullChat from '@/components/chat/FullChat'
import LeaderboardScreen from '@/screens/leaderboard/LeaderboardScreen'
import TokenomicsScreen from '@/screens/tokenomics/TokenomicsScreen'
import KeyboardShortcutsOverlay from '@/components/common/KeyboardShortcutsOverlay'

interface OverlayContentProps {
  type: Overlay
  onClose: () => void
}

const OverlayContent: React.FC<OverlayContentProps> = ({ type, onClose }) => {
  const setState = useStateMachine((state) => state.setState)

  switch (type) {
    case Overlay.SOUND:
      return (
        <SoundSettings
          isOpen={true}
          onClose={onClose}
        />
      )

    case Overlay.ACCOUNT:
      return <AccountScreen onClose={onClose} />

    case Overlay.CHAT:
      return (
        <FullChat
          onClose={onClose}
          onPlayClick={() => {
            onClose()
            setState(MachineState.READY_TO_PLAY)  // Using enum instead of string
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
            setState(MachineState.READY_TO_PLAY)  // Using enum instead of string
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

  // Handle escape key
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activeOverlay) {
        closeOverlay()
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [activeOverlay, closeOverlay])

  if (!activeOverlay) return null

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        onClick={() => closeOverlay()} // Close on backdrop click
      />

      {/* Overlay Content */}
      <div className="relative z-10 h-full flex items-center justify-center">
        <div className="relative">
          {/* Close button */}
          <button
            onClick={() => closeOverlay()}
            className="absolute -top-4 -right-4 text-gray-400 hover:text-white transition-colors"
          >
            <span className="text-2xl">✕</span>
          </button>

          {/* Overlay content */}
          <OverlayContent
            type={activeOverlay}
            onClose={closeOverlay}
          />
        </div>
      </div>
    </div>
  )
}

export default OverlayManager

// Optional: Export a helper hook for components that need overlay status
export const useOverlayStatus = () => {
  const activeOverlay = useOverlayStore((state) => state.activeOverlay)
  return {
    isOverlayActive: !!activeOverlay,
    currentOverlay: activeOverlay,
  }
}
