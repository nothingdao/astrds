// src/components/common/KeyboardShortcutsOverlay.tsx
import React from 'react'
import { Kbd } from '@/components/ui/kbd'
import { useOverlayStore } from '@/stores/overlayStore'
import { Overlay } from '@/types/overlay'

type ShortcutRow = { keys: string[]; label: string }
type Section = { title: string; rows: ShortcutRow[] }

const SECTIONS: Section[] = [
  {
    title: 'Navigation',
    rows: [
      { keys: ['T'], label: 'Tokenomics' },
      { keys: ['F'], label: 'Full Chat' },
      { keys: ['L'], label: 'Leaderboard' },
      { keys: ['A'], label: 'Account' },
      { keys: ['?'], label: 'Keyboard shortcuts' },
      { keys: ['Esc'], label: 'Close overlay' },
    ],
  },
  {
    title: 'Gameplay',
    rows: [
      { keys: ['P'], label: 'Pause / Resume' },
      { keys: ['Esc'], label: 'Pause / Resume' },
      { keys: ['W', 'A', 'S', 'D'], label: 'Move ship' },
      { keys: ['↑', '←', '↓', '→'], label: 'Move ship (alt)' },
      { keys: ['Space'], label: 'Fire weapons' },
      { keys: ['C'], label: 'In-game chat' },
    ],
  },
  {
    title: 'Audio',
    rows: [
      { keys: ['M'], label: 'Toggle music' },
      { keys: ['1'], label: 'Volume 20%' },
      { keys: ['2'], label: 'Volume 40%' },
      { keys: ['3'], label: 'Volume 60%' },
      { keys: ['4'], label: 'Volume 80%' },
      { keys: ['5'], label: 'Volume 100%' },
    ],
  },
]

const KeyboardShortcutsOverlay: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div className='bg-black border border-white/15 w-full max-w-xl max-h-[80vh] overflow-y-auto'>
    {/* Header */}
    <div className='flex items-center justify-between px-6 py-4 border-b border-white/10'>
      <div>
        <h2 className='font-mono text-sm uppercase tracking-widest text-white'>Keyboard Shortcuts</h2>
        <p className='font-mono text-[10px] text-white/30 mt-0.5 uppercase tracking-wider'>Press <Kbd>?</Kbd> anywhere to show this</p>
      </div>
      <button
        onClick={onClose}
        className='font-mono text-xs text-white/30 hover:text-white transition-colors'
        aria-label='Close keyboard shortcuts'
      >
        <Kbd>Esc</Kbd>
      </button>
    </div>

    {/* Sections */}
    <div className='px-6 py-4 space-y-6'>
      {SECTIONS.map((section) => (
        <div key={section.title}>
          <div className='font-mono text-[9px] uppercase tracking-[0.25em] text-game-blue/60 mb-3'>
            {section.title}
          </div>
          <div className='space-y-1.5'>
            {section.rows.map(({ keys, label }) => (
              <div key={label} className='flex items-center justify-between'>
                <span className='font-mono text-xs text-white/50'>{label}</span>
                <div className='flex items-center gap-1'>
                  {keys.map((k, i) => (
                    <React.Fragment key={k}>
                      <Kbd>{k}</Kbd>
                      {i < keys.length - 1 && (
                        <span className='font-mono text-[10px] text-white/20'>+</span>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>

    <div className='px-6 py-3 border-t border-white/10'>
      <p className='font-mono text-[9px] text-white/20 uppercase tracking-wider'>
        Keyboard shortcuts are disabled when a text input is focused
      </p>
    </div>
  </div>
)

// Wrapper that reads from the overlay store so OverlayManager can render it
export const KeyboardShortcutsOverlayConnected: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <KeyboardShortcutsOverlay onClose={onClose} />
)

export default KeyboardShortcutsOverlay
