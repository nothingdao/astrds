// src/components/theme/ThemeController.tsx
import { useEffect } from 'react'
import { useThemeStore } from '@/stores/themeStore'
import { refreshDesignTokens } from '@/lib/designTokens'

const THEME_CLASSES = ['theme-dark', 'theme-light']

const ThemeController = () => {
  const mode = useThemeStore((state) => state.mode)

  useEffect(() => {
    const root = document.documentElement
    root.classList.remove(...THEME_CLASSES)
    root.classList.add(`theme-${mode}`)
    root.dataset.theme = mode
    refreshDesignTokens()
  }, [mode])

  return null
}

export default ThemeController
