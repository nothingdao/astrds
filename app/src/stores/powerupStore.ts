// src/stores/powerupStore.ts
import { create } from "zustand";
import { PowerupStore, PowerupState } from "@/types/stores/powerup";

const POWERUP_DURATION = 10_000; // 10 seconds

const initialState: PowerupState = {
  powerups: {
    invincible: false,
    rapidFire: false,
  },
  powerupExpiresAt: null,
};

let _powerupTimer: ReturnType<typeof setTimeout> | null = null;

export const usePowerupStore = create<PowerupStore>((set) => ({
  ...initialState,

  activatePowerups: () => {
    if (_powerupTimer) clearTimeout(_powerupTimer);
    const expiresAt = Date.now() + POWERUP_DURATION;
    set({
      powerups: { invincible: true, rapidFire: true },
      powerupExpiresAt: expiresAt,
    });
    _powerupTimer = setTimeout(() => {
      set({
        powerups: { invincible: false, rapidFire: false },
        powerupExpiresAt: null,
      });
      _powerupTimer = null;
    }, POWERUP_DURATION);
  },

  deactivatePowerups: () => {
    if (_powerupTimer) {
      clearTimeout(_powerupTimer);
      _powerupTimer = null;
    }
    set({
      powerups: { invincible: false, rapidFire: false },
      powerupExpiresAt: null,
    });
  },

  // kept for targeted powerup types if needed in future
  activatePowerup: (type: string) =>
    set((state) => ({
      powerups: { ...state.powerups, [type]: true },
    })),
}));
