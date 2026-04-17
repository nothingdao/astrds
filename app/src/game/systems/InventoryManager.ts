// src/game/systems/InventoryManager.ts
export class InventoryManager {
  constructor() {
    this.items = {
      ships: {
        max: 5,
        default: 3,
        icon: 'ship',
        onUse: (gameState) => {
          if (gameState.inventory.ships > 0) {
            gameState.inventory.ships--
            return true
          }
          return false
        },
      },
      pills: {
        max: 99,
        default: 0,
        icon: 'pill',
        onUse: (gameState) => {
          if (gameState.inventory.pills > 0) {
            gameState.inventory.pills--
            // Add pill effects here
            return true
          }
          return false
        },
      },
      tokens: {
        max: 99,
        default: 0,
        icon: 'token',
        onUse: (gameState) => {
          if (gameState.inventory.tokens > 0) {
            gameState.inventory.tokens--
            return true
          }
          return false
        },
      },
    }
  }

  // Add item to inventory
  addItem(state, itemType, amount = 1) {
    if (!this.items[itemType]) return false

    const currentAmount = state.inventory[itemType] || 0
    const maxAmount = this.items[itemType].max

    state.inventory[itemType] = Math.min(currentAmount + amount, maxAmount)
    return true
  }

  // Remove item from inventory
  removeItem(state, itemType, amount = 1) {
    if (!this.items[itemType]) return false

    const currentAmount = state.inventory[itemType] || 0
    if (currentAmount < amount) return false

    state.inventory[itemType] = currentAmount - amount
    return true
  }

  // Use an item
  useItem(state, itemType) {
    if (!this.items[itemType] || !this.items[itemType].onUse) return false
    return this.items[itemType].onUse(state)
  }

  // Check if can add item
  canAddItem(state, itemType, amount = 1) {
    if (!this.items[itemType]) return false

    const currentAmount = state.inventory[itemType] || 0
    return currentAmount + amount <= this.items[itemType].max
  }

  // Get item maximum
  getItemMax(itemType) {
    return this.items[itemType]?.max || 0
  }

  // Reset inventory to defaults
  resetInventory(state) {
    state.inventory = Object.keys(this.items).reduce((acc, itemType) => {
      acc[itemType] = this.items[itemType].default
      return acc
    }, {})
  }
}

export const inventoryManager = new InventoryManager()
