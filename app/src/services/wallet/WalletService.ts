// src/services/wallet/WalletService.ts
class WalletService {
  disconnectCallback: (() => void) | null;

  constructor() {
    this.disconnectCallback = null;
  }

  getProvider(): any {
    const w = window as any;
    if ("phantom" in w && w.phantom?.solana) {
      return w.phantom.solana;
    }
    return null;
  }

  async attemptAutoConnect() {
    try {
      const provider = this.getProvider();
      if (!provider) return false;

      const resp = await provider.connect({ onlyIfTrusted: true });
      console.log("Auto-connected to wallet:", resp.publicKey.toString());

      this.setupDisconnectListener();
      return true;
    } catch (err) {
      if ((err as any).code !== 4001) {
        console.error("Auto-connect error:", err);
      }
      return false;
    }
  }

  setupDisconnectListener() {
    const provider = this.getProvider();
    if (!provider) return;

    provider.removeAllListeners("disconnect");

    provider.on("disconnect", () => {
      console.log("Wallet disconnected");
      if (this.disconnectCallback) {
        this.disconnectCallback();
      }
    });
  }

  onDisconnect(callback: () => void) {
    this.disconnectCallback = callback;
  }
}

export const walletService = new WalletService();
