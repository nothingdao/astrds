// src/stores/spaceTokenStore.ts
// Tracks active space deposits (for spawning) and tokens collected this session
import { create } from "zustand";
import type { Id } from "../../convex/_generated/dataModel";
import { getTokenColor } from "@/lib/tokenColors";

export interface SpaceDeposit {
  _id: Id<"spaceDeposits">;
  mintAddress: string;
  programId: string;
  symbol: string;
  name: string;
  logoUri?: string;
  decimals: number;
  totalAmount: number;
  remainingAmount: number;
  tokensPerPill: number;
  minLevel: number;
  maxLevel: number;
  status: "active" | "depleted" | "cancelled";
}

export interface CollectedSpaceToken {
  depositId: Id<"spaceDeposits">;
  mintAddress: string;
  symbol: string;
  name: string;
  logoUri?: string;
  decimals: number;
  tokensPerPill: number; // raw units
  pillCount: number;
  color: string; // deterministic from mintAddress via getTokenColor
}

interface SpaceTokenStore {
  activePools: SpaceDeposit[];
  collectedThisSession: CollectedSpaceToken[];
  setActivePools: (pools: SpaceDeposit[]) => void;
  recordCollection: (deposit: SpaceDeposit) => void;
  resetSession: () => void;
}

export const useSpaceTokenStore = create<SpaceTokenStore>((set, get) => ({
  activePools: [],
  collectedThisSession: [],

  setActivePools: (pools) => set({ activePools: pools }),

  recordCollection: (deposit) => {
    const existing = get().collectedThisSession.find(
      (c) => c.depositId === deposit._id
    );
    if (existing) {
      set((state) => ({
        collectedThisSession: state.collectedThisSession.map((c) =>
          c.depositId === deposit._id ? { ...c, pillCount: c.pillCount + 1 } : c
        ),
      }));
    } else {
      set((state) => ({
        collectedThisSession: [
          ...state.collectedThisSession,
          {
            depositId: deposit._id,
            mintAddress: deposit.mintAddress,
            symbol: deposit.symbol,
            name: deposit.name,
            logoUri: deposit.logoUri,
            decimals: deposit.decimals,
            tokensPerPill: deposit.tokensPerPill,
            pillCount: 1,
            color: getTokenColor(deposit.mintAddress),
          },
        ],
      }));
    }
  },

  resetSession: () => set({ collectedThisSession: [] }),
}));
