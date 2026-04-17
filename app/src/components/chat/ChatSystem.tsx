// src/components/chat/ChatSystem.tsx
import React, { useEffect } from 'react'
import { useChatStore } from '@/stores/chatStore'
import { useWallet } from '@solana/wallet-adapter-react'
import { useKeyboardCommands } from '@/hooks/useKeyboardCommands'
import { useStateMachine } from '@/stores/stateMachine'
import { MachineState } from '@/types/machine'
import OverlayChat from './OverlayChat'

const ChatSystem: React.FC = () => {
  const { connected } = useWallet()
  const { overlayVisible, toggleOverlay, initializeChat } = useChatStore()
  const currentGameState = useStateMachine((state) => state.currentState)

  const isGameplay =
    currentGameState === MachineState.PLAYING ||
    currentGameState === MachineState.PAUSED

  // C — toggle in-game chat sidebar (only during gameplay, not when typing)
  useKeyboardCommands({
    key: 'KeyC',
    action: () => {
      if (isGameplay) toggleOverlay()
    },
    description: 'Toggle chat overlay',
  })

  useEffect(() => {
    if (connected) {
      initializeChat().catch(console.error)
    }
  }, [connected, initializeChat])

  // Close overlay when leaving gameplay
  useEffect(() => {
    if (!isGameplay && overlayVisible) {
      useChatStore.getState().closeChat()
    }
  }, [isGameplay, overlayVisible])

  if (!isGameplay || !overlayVisible) return null

  return <OverlayChat />
}

export default ChatSystem
