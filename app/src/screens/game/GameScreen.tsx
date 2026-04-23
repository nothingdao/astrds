// src/screens/game/GameScreen.tsx
import React, { useEffect, useRef } from 'react'
import { useStateMachine, selectIsPaused } from '@/stores/stateMachine'
import { useEngineStore } from '@/stores/engineStore'
import { useInventoryStore } from '@/stores/inventoryStore'
import { useGameData } from '@/stores/gameData'
import Ship from '@/game/entities/Ship'
// import OverlayChat from '@/components/chat/OverlayChat'
import PauseOverlay from './components/PauseOverlay'
import DeathDisplay from './components/DeathDisplay'
import SpacePoolSync from '@/components/space/SpacePoolSync'
import { useSpaceTokenStore } from '@/stores/spaceTokenStore'
import { MachineState } from '@/types/machine'
import { GameScreenProps } from '@/types/components/layout'
import ServerGameScreen from './ServerGameScreen'

const WS_URL = import.meta.env.VITE_WS_URL

const GameScreen: React.FC<GameScreenProps> = ({ className }) => {
  if (WS_URL) {
    return <ServerGameScreen className={className} />
  }

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mountedRef = useRef(false)

  // Game state management
  const setState = useStateMachine((state) => state.setState)
  const isPaused = useStateMachine(selectIsPaused)
  const setPause = useStateMachine((state) => state.setPause)

  // Engine state management
  const {
    initializeEngine,
    startGameLoop,
    stopGameLoop,
    resetEngine,
    setKey,
    addEntity,
    screen,
  } = useEngineStore()

  // Handle pause
  useEffect(() => {
    if (isPaused) {
      stopGameLoop()
    } else if (mountedRef.current) {
      startGameLoop()
    }
  }, [isPaused, stopGameLoop, startGameLoop])

  // Game initialization
  useEffect(() => {
    if (mountedRef.current) return
    console.log('Initializing game screen...')

    const initGame = async () => {
      await new Promise(resolve => requestAnimationFrame(resolve))

      if (!canvasRef.current) {
        console.error('Canvas ref not available')
        return
      }

      const context = canvasRef.current.getContext('2d')
      if (!context) {
        console.error('Could not get canvas context')
        return
      }
      console.log('Setting up game engine...')

      try {
        // Reset all game state for a fresh game
        resetEngine()
        useInventoryStore.getState().resetInventory()
        useSpaceTokenStore.getState().resetSession()
        useGameData.getState().resetGame()
        initializeEngine(context)

        // Create ship
        console.log('Creating ship...')
        const ship = new Ship({
          position: {
            x: screen.width / 2,
            y: screen.height / 2,
          },
          onDie: () => {
            console.log('Ship destroyed')
            setState(MachineState.GAME_OVER)

            // is this a good place to set the sessionEnd in the new blob?
            stopGameLoop()
          },
        })
        addEntity(ship, 'ship')

        // Spawn initial asteroids
        console.log('Spawning initial asteroids...')
        const engineStore = useEngineStore.getState()
        engineStore.spawnAsteroids(2)

        // Start game loop if not paused
        if (!isPaused) {
          console.log('Starting game loop...')
          startGameLoop()
        }
        mountedRef.current = true
      } catch (error) {
        console.error('Game initialization error:', error)
      }
    }

    initGame()

    // Cleanup
    return () => {
      console.log('Cleaning up game screen...')
      mountedRef.current = false
      stopGameLoop()
      resetEngine()
    }
  }, [])

  // Resize handler — keep canvas in sync when window changes (tiling WM, wallet popups, etc.)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>

    const handleResize = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        if (!canvasRef.current) return

        const ratio = window.devicePixelRatio || 1
        const width = window.innerWidth
        const height = window.innerHeight

        useEngineStore.setState({ screen: { width, height, ratio } })

        // Canvas width/height attrs update via React re-render, which resets the context.
        // Grab a fresh context on the next frame after the DOM settles.
        requestAnimationFrame(() => {
          if (!canvasRef.current) return
          const ctx = canvasRef.current.getContext('2d')
          if (ctx) initializeEngine(ctx)
        })
      }, 100)
    }

    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      clearTimeout(timer)
    }
  }, [initializeEngine])

  // Keyboard controls with pause handling
  useEffect(() => {
    console.log('Setting up keyboard controls...')

    const handleKeyDown = (e: KeyboardEvent) => {
      // Never intercept when focus is in a text field (chat input, etc.)
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) return

      // Handle pause key
      if (e.code === 'Escape' || e.code === 'KeyP') {
        setPause(!isPaused)
        return
      }

      // Don't process other controls if paused
      if (isPaused) return

      switch (e.code) {
        case 'ArrowLeft':
        case 'KeyA':
          setKey('left', 1)
          break
        case 'ArrowRight':
        case 'KeyD':
          setKey('right', 1)
          break
        case 'ArrowUp':
        case 'KeyW':
          setKey('up', 1)
          break
        case 'Space':
          setKey('space', 1)
          break
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (isPaused) return

      switch (e.code) {
        case 'ArrowLeft':
        case 'KeyA':
          setKey('left', 0)
          break
        case 'ArrowRight':
        case 'KeyD':
          setKey('right', 0)
          break
        case 'ArrowUp':
        case 'KeyW':
          setKey('up', 0)
          break
        case 'Space':
          setKey('space', 0)
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [setKey, isPaused, setPause])

  return (
    <>
      <canvas
        ref={canvasRef}
        width={screen.width * screen.ratio}
        height={screen.height * screen.ratio}
        className={`block bg-black absolute inset-0 w-full h-full ${className || ''}`}
      />
      {/* <OverlayChat /> */}
      {isPaused && <PauseOverlay />}
      <DeathDisplay />
      <SpacePoolSync />
    </>
  )
}

export default GameScreen
