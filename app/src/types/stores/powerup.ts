// src/types/stores/powerup.ts
export interface PowerupState {
  powerups: {
    invincible: boolean;
    rapidFire: boolean;
    beam?: boolean;
    spread?: boolean;
  };
  powerupExpiresAt: number | null;
}

export interface PowerupActions {
  activatePowerups: () => void;
  deactivatePowerups: () => void;
  activatePowerup: (type: string) => void; // Add this line
}

export type PowerupStore = PowerupState & PowerupActions;
