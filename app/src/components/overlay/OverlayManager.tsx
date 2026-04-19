// src/components/overlay/OverlayManager.tsx
import React, { useEffect } from 'react'
import { Coins, MessageSquare, Trophy, User, Rocket, Pickaxe } from 'lucide-react'
import { useOverlayStore } from '@/stores/overlayStore'
import { useStateMachine, selectMachineState } from '@/stores/stateMachine'
import { Overlay } from '@/types/overlay'
import { MachineState } from '@/types/machine'
import { Kbd } from '@/components/ui/kbd'
import SoundSettings from '../sound/SoundSettings'
import AccountScreen from '@/screens/account/AccountScreen'
import FullChat from '@/components/chat/FullChat'
import LeaderboardScreen from '@/screens/leaderboard/LeaderboardScreen'
import TokenomicsScreen from '@/screens/tokenomics/TokenomicsScreen'
import MiningScreen from '@/screens/mining/MiningScreen'
import KeyboardShortcutsOverlay from '@/components/common/KeyboardShortcutsOverlay'
import SendToSpaceOverlay from '@/components/space/SendToSpaceOverlay'

// Primary overlays — shown in the tab bar and cycled by [ and ]
const OVERLAY_TABS = [
  { overlay: Overlay.ASTRDS,      label: '$ASTRDS',     key: 'T', icon: Coins         },
  { overlay: Overlay.CHAT,        label: 'Chat',        key: 'F', icon: MessageSquare  },
  { overlay: Overlay.LEADERBOARD, label: 'Leaderboard', key: 'L', icon: Trophy         },
  { overlay: Overlay.ACCOUNT,     label: 'Account',     key: 'A', icon: User           },
  { overlay: Overlay.SPACE,       label: 'Space',       key: 'R', icon: Rocket         },
  { overlay: Overlay.MINING,      label: 'Mining',      key: 'M', icon: Pickaxe        },
] as const

// Overlays blocked while actively playing
const PLAYING_RESTRICTED = new Set([Overlay.ASTRDS, Overlay.LEADERBOARD, Overlay.SPACE])

const OVERLAY_MAX_WIDTH: Record<Overlay, string> = {
  [Overlay.NONE]:        'max-w-4xl',
  [Overlay.SOUND]:       'max-w-lg',
  [Overlay.ACCOUNT]:     'max-w-5xl',
  [Overlay.CHAT]:        'max-w-2xl',
  [Overlay.LEADERBOARD]: 'max-w-4xl',
  [Overlay.ASTRDS]:      'max-w-4xl',
  [Overlay.MINING]:      'max-w-3xl',
  [Overlay.SHORTCUTS]:   'max-w-lg',
  [Overlay.SPACE]:       'max-w-2xl',
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

    case Overlay.ASTRDS:
      return <TokenomicsScreen onClose={onClose} />

    case Overlay.MINING:
      return <MiningScreen onClose={onClose} />

    case Overlay.SHORTCUTS:
      return <KeyboardShortcutsOverlay onClose={onClose} />

    case Overlay.SPACE:
      return <SendToSpaceOverlay onClose={onClose} />

    default:
      return null
  }
}

const OverlayManager: React.FC = () => {
  const activeOverlay = useOverlayStore((state) => state.activeOverlay)
  const closeOverlay = useOverlayStore((state) => state.closeOverlay)
  const openOverlay = useOverlayStore((state) => state.openOverlay)
  const currentState = useStateMachine(selectMachineState)

  const isTabDisabled = (overlay: Overlay) =>
    currentState === MachineState.PLAYING && PLAYING_RESTRICTED.has(overlay)

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) return

      if (e.key === 'Escape') {
        if (activeOverlay) closeOverlay()
        return
      }

      if (e.key === '[' || e.key === ']') {
        e.preventDefault()
        const enabled = OVERLAY_TABS.filter(
          t => !(currentState === MachineState.PLAYING && PLAYING_RESTRICTED.has(t.overlay))
        )
        if (enabled.length === 0) return

        const currentIdx = enabled.findIndex(t => t.overlay === activeOverlay)

        if (currentIdx === -1) {
          // No active tab in list — open first or last depending on direction
          openOverlay(e.key === ']' ? enabled[0].overlay : enabled[enabled.length - 1].overlay)
        } else {
          const nextIdx = e.key === ']'
            ? (currentIdx + 1) % enabled.length
            : (currentIdx - 1 + enabled.length) % enabled.length
          openOverlay(enabled[nextIdx].overlay)
        }
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [activeOverlay, closeOverlay, openOverlay, currentState])

  if (!activeOverlay) return null

  const maxWidth = OVERLAY_MAX_WIDTH[activeOverlay as Overlay]

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center p-4'>
      <div className='absolute inset-0 bg-black/80' onClick={closeOverlay} />
      <div className={`relative z-10 w-full ${maxWidth} max-h-[88vh] bg-neutral-900 border border-white/25 flex flex-col shadow-[0_0_60px_rgba(0,0,0,0.9)]`}>

        {/* Tab bar */}
        <div className='flex items-stretch border-b border-white/15 shrink-0'>
          <div className='flex items-stretch overflow-x-auto flex-1 min-w-0'>
            {OVERLAY_TABS.map(({ overlay, label, key, icon: Icon }) => {
              const isActive = activeOverlay === overlay
              const disabled = isTabDisabled(overlay)
              return (
                <button
                  key={overlay}
                  onClick={() => !disabled && openOverlay(overlay)}
                  disabled={disabled}
                  title={disabled ? `${label} (unavailable during gameplay)` : `${label} [${key}]`}
                  className={`flex items-center gap-1.5 px-3 py-2.5 font-mono text-[10px] uppercase tracking-widest whitespace-nowrap border-b-2 -mb-px transition-colors
                    ${isActive
                      ? 'border-game-blue text-white'
                      : disabled
                        ? 'border-transparent text-white/15 cursor-not-allowed'
                        : 'border-transparent text-white/35 hover:text-white/65'
                    }`}
                >
                  <Icon size={10} />
                  <span>{label}</span>
                  <span className={`text-[8px] normal-case tracking-normal font-mono ${isActive ? 'text-white/25' : 'text-white/15'}`}>{key}</span>
                </button>
              )
            })}
          </div>

          {/* Cycle hint + close */}
          <div className='flex items-center gap-2.5 px-3 shrink-0 border-l border-white/10'>
            <span className='hidden sm:flex items-center gap-0.5 font-mono text-[9px] text-white/20'>
              <Kbd>[</Kbd><Kbd>]</Kbd>
            </span>
            <button
              onClick={closeOverlay}
              className='flex items-center gap-1.5 font-mono text-[10px] text-white/30 hover:text-white transition-colors'
              aria-label='Close'
            >
              close <Kbd>Esc</Kbd>
            </button>
          </div>
        </div>

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
