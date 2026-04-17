// src/stores/audioStore.ts
import { create } from 'zustand'

export const useAudioStore = create((set) => ({
  isSettingsPanelOpen: false,

  openSettingsPanel: () => set({ isSettingsPanelOpen: true }),
  closeSettingsPanel: () => set({ isSettingsPanelOpen: false }),
  toggleSettingsPanel: () =>
    set((state) => ({
      isSettingsPanelOpen: !state.isSettingsPanelOpen,
    })),
}))
