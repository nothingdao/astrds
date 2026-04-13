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

const KeyboardShortcutsOverlay: React.FC<{ onClose: () => void }> = () => (
  <div className='px-6 py-5 space-y-6'>
    <p className='font-mono text-[10px] text-white/30 uppercase tracking-wider'>
      Press <Kbd>?</Kbd> anywhere to show this. Shortcuts are disabled when a text input is focused.
    </p>

    {SECTIONS.map((section) => (
      <div key={section.title}>
        <div className='font-mono text-[9px] uppercase tracking-[0.25em] text-game-blue/50 mb-3'>
          {section.title}
        </div>
        <div className='space-y-2'>
          {section.rows.map(({ keys, label }) => (
            <div key={label} className='flex items-center justify-between'>
              <span className='font-mono text-xs text-white/50'>{label}</span>
              <div className='flex items-center gap-1'>
                {keys.map((k, i) => (
                  <React.Fragment key={k}>
                    <Kbd>{k}</Kbd>
                    {i < keys.length - 1 && (
                      <span className='font-mono text-[10px] text-white/20'>/</span>
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
)

export default KeyboardShortcutsOverlay
