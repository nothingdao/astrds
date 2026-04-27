// src/components/theme/ThemeToggle.tsx
import React from 'react'
import { Moon, Sun } from 'lucide-react'
import { useThemeStore } from '@/stores/themeStore'

const ThemeToggle: React.FC = () => {
  const mode = useThemeStore((state) => state.mode)
  const toggleTheme = useThemeStore((state) => state.toggleTheme)
  const isDark = mode === 'dark'

  return (
    <button
      type='button'
      onClick={toggleTheme}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className='btn-grain h-8 px-3 flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider transition-colors bg-card text-card-foreground border border-border hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background'
    >
      {isDark ? <Sun size={13} /> : <Moon size={13} />}
      <span className='hidden lg:inline'>{isDark ? 'Light' : 'Dark'}</span>
    </button>
  )
}

export default ThemeToggle
