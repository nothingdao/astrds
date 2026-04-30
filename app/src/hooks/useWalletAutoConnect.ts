// src/hooks/useWalletAutoConnect.ts
import { useEffect } from "react";
import { walletService } from "../services/wallet/WalletService";
import { useStateMachine } from "../stores/stateMachine";
import { MachineState } from "@/types/machine";

export const useWalletAutoConnect = () => {
  const setState = useStateMachine((state) => state.setState);

  useEffect(() => {
    walletService.onDisconnect(() => {
      setState(MachineState.INITIAL);
    });

    walletService.attemptAutoConnect();

    return () => {
      walletService.onDisconnect(null);
      const provider = walletService.getProvider();
      if (provider) {
        provider.removeAllListeners("disconnect");
      }
    };
  }, [setState]);
};
