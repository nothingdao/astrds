// src/App.tsx
import React, { useMemo, useEffect, useState } from 'react'
import {
  ConnectionProvider,
  WalletProvider,
} from '@solana/wallet-adapter-react'
import GameWalletModalProvider from '@/components/wallet/GameWalletModal'
import GameLayout from './screens/game/components/GameLayout'
import GameStateManager from './screens/game/components/GameStateManager'
import ChatSystem from './components/chat/ChatSystem'
import OverlayManager from './components/overlay/OverlayManager'
import { useSettingsPanelStore } from './stores/settingsPanelStore'
import { useOverlayStore } from './stores/overlayStore'
import { useAudio } from './hooks/useAudio'
import { useWalletAutoConnect } from './hooks/useWalletAutoConnect'
import { audioManager } from './services/audio/AudioManager'
import { audioService } from './services/audio/AudioService'
import { Overlay } from './types/overlay'
import { Commitment } from '@solana/web3.js';
import { RPC_ENDPOINT } from '@/lib/solana';
import ThemeController from '@/components/theme/ThemeController'


interface LoadingOverlayProps {
  progress: number;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ progress }) => (
  <div className='fixed inset-0 bg-background text-foreground flex items-center justify-center z-50'>
    <div className='text-center'>
      <h2 className='text-xl text-primary mb-4'>Loading Game Assets</h2>
      <div className='w-64 h-2 bg-surface-subtle rounded-full overflow-hidden'>
        <div
          className='h-full bg-primary transition-all duration-300'
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className='mt-2 text-sm text-muted-foreground'>
        Loading sounds... {Math.round(progress)}%
      </div>
    </div>
  </div>
)

const App: React.FC = () => {
  useWalletAutoConnect()
  const [isLoading, setIsLoading] = useState(true)
  const [loadingProgress, setLoadingProgress] = useState(0)


  const { volumes, setVolume, isInitialized } = useAudio();
  const toggleSettingsPanel = useSettingsPanelStore((state) => state.toggle);
  const openOverlay = useOverlayStore((state) => state.openOverlay);
  const endpoint = useMemo(() => RPC_ENDPOINT, [])

  useEffect(() => {
    const unsub = audioService.on('progress', ({ percent }) => {
      setLoadingProgress(percent)
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    if (isInitialized) {
      setIsLoading(false)
      audioManager.start()
    }
  }, [isInitialized])

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return
      }

      switch (e.key.toLowerCase()) {
        case 'h':
          setVolume('master', volumes.master > 0 ? 0 : 0.5)
          break
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
          setVolume('master', parseInt(e.key) / 5)
          break
        case 't':
          openOverlay(Overlay.ASTRDS)
          break
        case 'm':
          openOverlay(Overlay.MINING)
          break
        case 'f':
          openOverlay(Overlay.CHAT)
          break
        case 'l':
          openOverlay(Overlay.LEADERBOARD)
          break
        case 'a':
          openOverlay(Overlay.ACCOUNT)
          break
        case '?':
          openOverlay(Overlay.HELP)
          break
        case '`':
          openOverlay(Overlay.ADMIN)
          break
        default:
          break
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [toggleSettingsPanel, setVolume, openOverlay, volumes.master])

  // Do not instantiate legacy Phantom/Solflare adapters. Modern wallets register
  // through the Solana Wallet Standard and WalletProvider discovers them
  // automatically; adding explicit adapters causes duplicate-wallet warnings and
  // can confuse wallet network detection.
  const wallets = useMemo(() => [], [])

  const config = {
    commitment: 'confirmed' as Commitment, // Cast to Commitment
    wsEndpoint: endpoint.replace('https', 'wss'),
    preflightCommitment: 'processed' as Commitment, // Cast to Commitment
    confirmTransactionInitialTimeout: 60000,
  }

  return (
    <ConnectionProvider
      endpoint={endpoint}
      config={config}
    >
      <WalletProvider
        wallets={wallets}
        autoConnect
      >
        <GameWalletModalProvider>
          <ThemeController />
          <GameLayout>
            {isLoading ? (
              <LoadingOverlay progress={loadingProgress} />
            ) : (
              <>
                <GameStateManager />
                <ChatSystem />
                <OverlayManager />
                {/* <Debugger /> */}

              </>
            )}
          </GameLayout>
        </GameWalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  )
}

export default App
