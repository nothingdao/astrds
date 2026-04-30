// src/stores/themeStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeMode = "dark" | "light";

interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: "dark",
      setMode: (mode) => set({ mode }),
      toggleTheme: () =>
        set({ mode: get().mode === "dark" ? "light" : "dark" }),
    }),
    { name: "astrds-theme" }
  )
);
