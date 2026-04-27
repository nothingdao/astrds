// src/screens/help/HelpScreen.tsx
import React, { useCallback, useState } from 'react'
import { Keyboard } from 'lucide-react'
import KeyboardShortcutsOverlay from '@/components/common/KeyboardShortcutsOverlay'
import { useArrowTabNav } from '@/hooks/useArrowTabNav'

type HelpTab = 'keyboard'
const HELP_TABS: HelpTab[] = ['keyboard']

const HelpScreen: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [tab, setTab] = useState<HelpTab>('keyboard')
  const setTabCb = useCallback((t: HelpTab) => setTab(t), [])
  useArrowTabNav(HELP_TABS, tab, setTabCb)

  return (
    <div className='flex flex-col h-full'>
      <div className='flex border-b border-border px-5 shrink-0'>
        {([
          { id: 'keyboard' as HelpTab, icon: Keyboard, label: 'Keyboard' },
        ]).map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 font-mono text-[10px] uppercase tracking-wider transition-colors border-b-2 -mb-px ${
              tab === id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-tx-secondary'
            }`}
          >
            <Icon size={10} />
            {label}
          </button>
        ))}
      </div>

      <div className='flex-1 overflow-y-auto min-h-0'>
        {tab === 'keyboard' && <KeyboardShortcutsOverlay onClose={onClose} />}
      </div>
    </div>
  )
}

export default HelpScreen
