import { create } from 'zustand'

// Constants for max item limits
const MAX_LIMITS = {
  ships: 5,
  tokens: 99,
  pills: 99,
} as const

type InventoryStoreState = {
  items: {
    ships: number
    tokens: number
    pills: number
  }
  addItem: (itemType: keyof typeof MAX_LIMITS, amount?: number) => void
  useItem: (itemType: keyof typeof MAX_LIMITS) => boolean
  resetInventory: () => void
}

export const useInventoryStore = create<InventoryStoreState>((set, get) => ({
  // Initial state
  items: {
    ships: 3,
    tokens: 0,
    pills: 0,
  },

  // Actions
  addItem: (itemType, amount = 1) =>
    set((state) => ({
      items: {
        ...state.items,
        [itemType]: Math.min(
          state.items[itemType] + amount,
          MAX_LIMITS[itemType]
        ),
      },
    })),

  useItem: (itemType) => {
    const currentCount = get().items[itemType]
    if (currentCount <= 0) return false

    set((state) => ({
      items: {
        ...state.items,
        [itemType]: state.items[itemType] - 1,
      },
    }))
    return true
  },

  // Reset inventory
  resetInventory: () =>
    set({
      items: {
        ships: 3, // Start with 3 ships
        tokens: 0,
        pills: 0,
      },
    }),
}))
