// src/types/stores/settings.ts
export interface SettingsPanelStoreState {
  isOpen: boolean
}

export interface SettingsPanelStoreActions {
  toggle: () => void
  open: () => void
  close: () => void
}

export type SettingsPanelStore = SettingsPanelStoreState &
  SettingsPanelStoreActions
