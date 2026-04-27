// src/screens/ready/ReadyScreen.tsx
import React, { useState, useEffect, useRef } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useAudio } from '../../hooks/useAudio'
import { useAuth } from '@/hooks/useAuth'
import { useStateMachine } from '@/stores/stateMachine'
import { useGameData } from '@/stores/gameData'
import { SOUND_TYPES } from '../../services/audio/AudioTypes'
import ScreenContainer from '@/components/common/ScreenContainer'
import GameTitle from '@/components/common/GameTitle'
import { Button } from '@/components/ui/button'
import { MachineState } from '@/types/machine'

const QUARTER_INSERT_DURATION = 1200

const ReadyScreen: React.FC = () => {
  const [countdown, setCountdown] = useState<number | null>(null)
  const [isQuarterInserting, setIsQuarterInserting] = useState(true)
  const [verificationError, setVerificationError] = useState<string | null>(null)
  const sequenceStartedRef = useRef(false)
  const mountedRef = useRef(true)

  const { playSound } = useAudio()
  const { clearAuth } = useAuth()
  const startTransition = useStateMachine(state => state.startTransition)
  const wallet = useWallet()
  const startGameSession = useGameData(state => state.startGameSession)

  useEffect(() => {
    mountedRef.current = true

    if (sequenceStartedRef.current) {
      console.log('Sequence already started, skipping')
      return
    }

    const startGameSequence = async () => {
      try {
        sequenceStartedRef.current = true
        console.log('Starting game sequence...')

        // Initialize game session
        if (wallet.publicKey) {
          await startGameSession(wallet.publicKey.toString())
          console.log('Game session started')
        }

        // AudioManager handles the music transition (TITLE → READY) via SOUND_MAP.
        // We control the coin sound ourselves so it hits during "Inserting Quarter..."
        // rather than firing immediately on state entry.
        await playSound(SOUND_TYPES.QUARTER_INSERT)
        await new Promise((resolve) => setTimeout(resolve, QUARTER_INSERT_DURATION))

        if (!mountedRef.current) return
        setIsQuarterInserting(false)

        // Start countdown
        for (let i = 3; i >= 0; i--) {
          if (!mountedRef.current) return

          setCountdown(i)
          if (i > 0) {
            await playSound(SOUND_TYPES.COUNTDOWN_PING)
            await new Promise((resolve) => setTimeout(resolve, 1000))
          }
        }

        if (mountedRef.current) {
          console.log('Countdown complete, transitioning to PLAYING')
          await new Promise(resolve => setTimeout(resolve, 100))
          await startTransition(MachineState.READY_TO_PLAY, MachineState.PLAYING)
        }
      } catch (error) {
        if (mountedRef.current) {
          const message = error instanceof Error ? error.message : String(error)
          console.error('Game start sequence failed:', error)
          setVerificationError(message)
          clearAuth()
        }
      }
    }

    startGameSequence()

    return () => {
      mountedRef.current = false
    }
  }, [startTransition, playSound, clearAuth, wallet.publicKey, startGameSession])

  const handleReturnToTitle = async () => {
    try {
      await startTransition(MachineState.READY_TO_PLAY, MachineState.INITIAL)
    } catch (error) {
      console.error('Failed to return to title:', error)
    }
  }

  if (verificationError) {
    return (
      <ScreenContainer screenType='READY_TO_PLAY'>
        <div className='text-center'>
          <GameTitle />
          <div className='text-destructive text-xl mb-6'>Failed to start game</div>
          <p className='text-muted-foreground mb-4'>{verificationError}</p>
          <Button variant='link' onClick={handleReturnToTitle}>
            Return to Title
          </Button>
        </div>
      </ScreenContainer>
    )
  }

  return (
    <ScreenContainer screenType='READY_TO_PLAY'>
      <div className='text-center'>
        <GameTitle />
        <div className='my-12 h-32 flex items-center justify-center'>
          <div className='text-8xl font-bold text-primary animate-[fadeIn_0.3s_ease-out]
                        [text-shadow:var(--text-shadow-accent-glow)]'>
            {isQuarterInserting ? (
              <div className='text-4xl'>Inserting Quarter...</div>
            ) : countdown === 0 ? (
              'GO!'
            ) : (
              countdown
            )}
          </div>
        </div>
        <div className='space-y-6 transition-opacity duration-300'>
          {!isQuarterInserting && countdown !== null && (
            <>
              <p className={`text-xl text-tx-secondary ${countdown >= 2 ? 'opacity-100' : 'opacity-0'}`}>
                Use [A][S][W][D] or Arrow Keys to move
              </p>
              <p className={`text-xl text-tx-secondary ${countdown >= 1 ? 'opacity-100' : 'opacity-0'}`}>
                Press [SPACE] to shoot
              </p>
              <p className={`text-xl text-tx-secondary ${countdown === 0 ? 'opacity-100' : 'opacity-0'}`}>
                Good luck, Anon!
              </p>
            </>
          )}
        </div>
        <div className='mt-16 text-tx-tertiary text-sm max-w-md mx-auto'>
          <p>
            Tip: Destroy asteroids to earn points. Smaller asteroids are worth
            more points!
          </p>
        </div>
      </div>
    </ScreenContainer>
  )
}

export default ReadyScreen
