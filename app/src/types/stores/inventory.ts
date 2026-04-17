// src/types/stores/inventory.ts
export interface InventoryItem {
  max: number
  default: number
  icon: string
  onUse: (gameState: any) => boolean
}

export interface InventoryItems {
  ships: number
  tokens: number
  pills: number
}

export interface InventoryStoreState {
  items: InventoryItems
}

export interface InventoryStoreActions {
  addItem: (itemType: keyof InventoryItems, amount?: number) => void
  useItem: (itemType: keyof InventoryItems) => boolean
  resetInventory: () => void
}

export type InventoryStore = InventoryStoreState & InventoryStoreActions
