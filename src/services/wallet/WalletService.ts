// src/services/wallet/WalletService.ts
class WalletService {
  constructor() {
    this.disconnectCallback = null
  }

  getProvider() {
    if ('phantom' in window && window.phantom?.solana) {
      return window.phantom.solana
    }
    return null
  }

  async attemptAutoConnect() {
    try {
      const provider = this.getProvider()
      if (!provider) return false

      const resp = await provider.connect({ onlyIfTrusted: true })
      console.log('Auto-connected to wallet:', resp.publicKey.toString())

      this.setupDisconnectListener()
      return true
    } catch (err) {
      if (err.code !== 4001) {
        console.error('Auto-connect error:', err)
      }
      return false
    }
  }

  setupDisconnectListener() {
    const provider = this.getProvider()
    if (!provider) return

    provider.removeAllListeners('disconnect')

    provider.on('disconnect', () => {
      console.log('Wallet disconnected')
      if (this.disconnectCallback) {
        this.disconnectCallback()
      }
    })
  }

  onDisconnect(callback) {
    this.disconnectCallback = callback
  }
}

export const walletService = new WalletService()
