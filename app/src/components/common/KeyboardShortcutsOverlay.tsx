// src/components/common/KeyboardShortcutsOverlay.tsx
import React from 'react'
import { Kbd } from '@/components/ui/kbd'

type ShortcutRow = { keys: string[]; label: string }
type Section = { title: string; rows: ShortcutRow[] }

const SECTIONS: Section[] = [
  {
    title: 'Navigation',
    rows: [
      { keys: [']'], label: 'Next overlay' },
      { keys: ['['], label: 'Previous overlay' },
      { keys: ['→'], label: 'Next sub-tab' },
      { keys: ['←'], label: 'Previous sub-tab' },
      { keys: ['T'], label: '$ASTRDS' },
      { keys: ['M'], label: 'Mining' },
      { keys: ['F'], label: 'Chat' },
      { keys: ['L'], label: 'Leaderboard' },
      { keys: ['A'], label: 'Account / Tokens' },
      { keys: ['?'], label: 'Help' },
      { keys: ['Esc'], label: 'Close overlay' },
    ],
  },
  {
    title: 'Gameplay',
    rows: [
      { keys: ['P'], label: 'Pause' },
      { keys: ['Esc'], label: 'Resume' },
      { keys: ['W', 'A', 'S', 'D'], label: 'Move ship' },
      { keys: ['↑', '←', '↓', '→'], label: 'Move ship (alt)' },
      { keys: ['Space'], label: 'Fire weapons' },
      { keys: ['C'], label: 'In-game chat' },
    ],
  },
  {
    title: 'Audio',
    rows: [
      { keys: ['H'], label: 'Hush (mute toggle)' },
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
    <p className='font-mono text-[10px] text-tx-tertiary uppercase tracking-wider'>
      Press <Kbd>?</Kbd> anywhere to show this. Shortcuts are disabled when a text input is focused.
    </p>

    {SECTIONS.map((section) => (
      <div key={section.title}>
        <div className='font-mono text-[10px] uppercase tracking-[0.25em] text-primary/70 mb-3'>
          {section.title}
        </div>
        <div className='space-y-2'>
          {section.rows.map(({ keys, label }) => (
            <div key={label} className='flex items-center justify-between'>
              <span className='font-mono text-xs text-tx-secondary'>{label}</span>
              <div className='flex items-center gap-1'>
                {keys.map((k, i) => (
                  <React.Fragment key={k}>
                    <Kbd>{k}</Kbd>
                    {i < keys.length - 1 && (
                      <span className='font-mono text-[10px] text-tx-dim'>/</span>
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
