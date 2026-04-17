// src/stores/levelStore.ts
import { create } from 'zustand'
import { audioService } from '../services/audio/AudioService'
import { useInventoryStore } from './inventoryStore'

type LevelStoreState = {
  level: number
  isLevelTransition: boolean
  isRespawning: boolean
}

type LevelStoreActions = {
  incrementLevel: () => void
  handleShipDestroyed: () => Promise<boolean>
  resetLevel: () => void
}

// src/stores/levelStore.ts
export const useLevelStore = create<LevelStoreState & LevelStoreActions>(
  (set, get) => ({
    level: 1,
    isLevelTransition: false,
    isRespawning: false,

    // Level management
    incrementLevel: () => {
      console.log('Incrementing level... Current state:', {
        currentLevel: get().level,
        isRespawning: get().isRespawning,
        isLevelTransition: get().isLevelTransition,
        timestamp: Date.now(),
      })

      // Add guard against both respawning AND level transition
      if (get().isRespawning || get().isLevelTransition) {
        console.log(
          'Blocked level increment - ' +
            (get().isRespawning
              ? 'ship is respawning'
              : 'level transition in progress')
        )
        return
      }

      set((state) => ({
        level: state.level + 1,
        isLevelTransition: true,
      }))

      console.log('Level incremented. New state:', {
        newLevel: get().level,
        timestamp: Date.now(),
      })

      setTimeout(() => {
        set({ isLevelTransition: false })
        console.log('Level transition ended')
      }, 2000)
    },

    // Ship destruction handling
    handleShipDestroyed: async () => {
      console.log('Ship destroyed. Current state:', {
        isRespawning: get().isRespawning,
        remainingShips: useInventoryStore.getState().items.ships,
        currentLevel: get().level,
        timestamp: Date.now(),
      })

      const inventoryStore = useInventoryStore.getState()
      const remainingShips = inventoryStore.items.ships

      if (remainingShips > 0) {
        inventoryStore.useItem('ships')
        set({ isRespawning: true })
        console.log('Respawn started')

        await new Promise((resolve) => setTimeout(resolve, 2000))
        set({ isRespawning: false })
        console.log('Respawn complete')

        return true
      } else {
        console.log('No ships remaining - game over')
        audioService.playSound('gameOver')
        return false
      }
    },

    resetLevel: () => {
      console.log('Resetting level state')
      set({
        level: 1,
        isLevelTransition: false,
        isRespawning: false,
      })
    },
  })
)
