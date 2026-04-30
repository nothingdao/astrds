import { create } from "zustand";

interface ServerStore {
  selectedUrl: string | null;
  selectedLabel: string | null;
  setSelected: (url: string, label: string) => void;
}

export const useServerStore = create<ServerStore>((set) => ({
  selectedUrl: null,
  selectedLabel: null,
  setSelected: (url, label) => set({ selectedUrl: url, selectedLabel: label }),
}));
