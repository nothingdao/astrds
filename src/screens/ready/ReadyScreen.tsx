// src/screens/ready/ReadyScreen.tsx
import React, { useState, useEffect, useRef } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useAudio } from '../../hooks/useAudio'
import { useAuth } from '@/hooks/useAuth'
import { useStateMachine } from '@/stores/stateMachine'
import { useEngineStore } from '@/stores/engineStore'
import { useGameData } from '@/stores/gameData' // Add this
import { SOUND_TYPES, MUSIC_TRACKS } from '../../services/audio/AudioTypes'
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

  const resetEngine = useEngineStore((state) => state.resetEngine)
  const { playSound, stopMusic, transitionMusic } = useAudio()
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

        await transitionMusic(MUSIC_TRACKS.TITLE, MUSIC_TRACKS.READY, {
          crossFadeDuration: 1000,
        })

        if (!mountedRef.current) return

        await playSound(SOUND_TYPES.QUARTER_INSERT)
        await new Promise((resolve) => setTimeout(resolve, QUARTER_INSERT_DURATION))

        if (!mountedRef.current) return
        setIsQuarterInserting(false)

        // Reset the engine state before countdown
        resetEngine()

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
          console.error('Game start sequence failed:', error)
          setVerificationError(error.message)
          clearAuth()
        }
      }
    }

    startGameSequence()

    return () => {
      mountedRef.current = false
      stopMusic(MUSIC_TRACKS.READY, { fadeOut: true })
    }
  }, [startTransition, resetEngine, playSound, stopMusic, transitionMusic, clearAuth, wallet.publicKey, startGameSession])

  const handleReturnToTitle = async () => {
    try {
      stopMusic(MUSIC_TRACKS.READY)
      await startTransition(MachineState.READY_TO_PLAY, MachineState.INITIAL)
    } catch (error) {
      console.error('Failed to return to title:', error)
    }
  }

  if (verificationError) {
    return (
      <ScreenContainer>
        <div className='text-center'>
          <GameTitle />
          <div className='text-game-red text-xl mb-6'>Failed to start game</div>
          <p className='text-gray-400 mb-4'>{verificationError}</p>
          <Button variant='link' onClick={handleReturnToTitle}>
            Return to Title
          </Button>
        </div>
      </ScreenContainer>
    )
  }

  return (
    <ScreenContainer>
      <div className='text-center'>
        <GameTitle />
        <div className='my-12 h-32 flex items-center justify-center'>
          <div className='text-8xl font-bold text-game-blue animate-[fadeIn_0.3s_ease-out]
                        [text-shadow:0_0_10px_#4dc1f9,0_0_20px_#4dc1f9,0_0_30px_#4dc1f9]'>
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
              <p className={`text-xl text-gray-300 ${countdown >= 2 ? 'opacity-100' : 'opacity-0'}`}>
                Use [A][S][W][D] or Arrow Keys to move
              </p>
              <p className={`text-xl text-gray-300 ${countdown >= 1 ? 'opacity-100' : 'opacity-0'}`}>
                Press [SPACE] to shoot
              </p>
              <p className={`text-xl text-gray-300 ${countdown === 0 ? 'opacity-100' : 'opacity-0'}`}>
                Good luck, Anon!
              </p>
            </>
          )}
        </div>
        <div className='mt-16 text-gray-500 text-sm max-w-md mx-auto'>
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
