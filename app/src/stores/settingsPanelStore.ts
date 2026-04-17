// src/stores/settingsPanelStore.ts
import { create } from 'zustand'

interface SettingsPanelState {
  isOpen: boolean
  toggle: () => void
  open: () => void
  close: () => void
}
export const useSettingsPanelStore = create<SettingsPanelState>((set) => ({
  isOpen: false,
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}))
