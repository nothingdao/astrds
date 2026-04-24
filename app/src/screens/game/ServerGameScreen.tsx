import React, { useEffect, useRef, useState } from 'react'
import { useStateMachine } from '@/stores/stateMachine'
import { useGameData } from '@/stores/gameData'
import { useInventoryStore } from '@/stores/inventoryStore'
import { useLevelStore } from '@/stores/levelStore'
import { usePowerupStore } from '@/stores/powerupStore'
import { useSpaceTokenStore } from '@/stores/spaceTokenStore'
import { useServerStore } from '@/stores/serverStore'
import { MachineState } from '@/types/machine'
import { renderServerSnapshot } from '@/game/renderServerSnapshot'
import type {
  ClientToServerMessage,
  GameSnapshot,
  InputState,
  ScreenBounds,
  ServerToClientMessage,
} from '@shared/game/protocol'

const emptyInput: InputState = {
  left: false,
  right: false,
  up: false,
  space: false,
}

const ServerGameScreen: React.FC<{ className?: string }> = ({ className }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const socketRef = useRef<WebSocket | null>(null)
  const inputRef = useRef<InputState>(emptyInput)
  const screenRef = useRef<ScreenBounds>({
    width: window.innerWidth,
    height: window.innerHeight,
  })
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null)
  const [screen, setScreen] = useState<ScreenBounds>({
    width: window.innerWidth,
    height: window.innerHeight,
  })
  const [ratio, setRatio] = useState(window.devicePixelRatio || 1)
  const [connectionState, setConnectionState] = useState<'connecting' | 'open' | 'closed'>('connecting')
  const setMachineState = useStateMachine((state) => state.setState)
  const setPause = useStateMachine((state) => state.setPause)
  const isPaused = useStateMachine((state) => state.isPaused)
  const isPausedRef = useRef(isPaused)
  isPausedRef.current = isPaused
  const selectedLabel = useServerStore((s) => s.selectedLabel)

  useEffect(() => {
    useGameData.getState().resetGame()
    useInventoryStore.getState().resetInventory()
    useLevelStore.getState().resetLevel()
    usePowerupStore.getState().deactivatePowerups()
    useSpaceTokenStore.getState().resetSession()
  }, [])

  useEffect(() => {
    const url = useServerStore.getState().selectedUrl ?? 'ws://localhost:3001'
    const socket = new WebSocket(url)
    socketRef.current = socket

    const send = (message: ClientToServerMessage) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(message))
      }
    }

    socket.addEventListener('open', () => {
      setConnectionState('open')
      const { currentSessionId, walletAddress } = useGameData.getState()
      send({
        type: 'hello',
        screen: screenRef.current,
        session: {
          gameSessionId: currentSessionId,
          walletAddress,
        },
      })
    })

    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data) as ServerToClientMessage
      if (message.type === 'state' || message.type === 'welcome' || message.type === 'gameOver') {
        setSnapshot(message.snapshot)
      }
    })

    socket.addEventListener('close', () => {
      setConnectionState('closed')
    })

    socket.addEventListener('error', () => {
      setConnectionState('closed')
    })

    return () => {
      socket.close()
      socketRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!snapshot) return

    useGameData.getState().updateScore(snapshot.score)
    useInventoryStore.setState({
      items: {
        ships: snapshot.lives,
        tokens: snapshot.tokensCollected,
        pills: snapshot.pillsCollected,
      },
    })
    useLevelStore.setState({
      level: snapshot.level,
      isLevelTransition: false,
      isRespawning: false,
    })
    usePowerupStore.setState({
      powerups: {
        invincible: snapshot.powerups.invincible,
        rapidFire: snapshot.powerups.rapidFire,
      },
      powerupExpiresAt: snapshot.powerups.expiresAt,
    })

    if (snapshot.status === 'gameOver') {
      setMachineState(MachineState.GAME_OVER)
    }
  }, [snapshot, setMachineState])

  useEffect(() => {
    if (!snapshot || !canvasRef.current) return
    const context = canvasRef.current.getContext('2d')
    if (!context) return
    renderServerSnapshot(context, snapshot, ratio)
  }, [ratio, snapshot])

  useEffect(() => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return
    socketRef.current.send(JSON.stringify({ type: isPaused ? 'pause' : 'resume' } satisfies ClientToServerMessage))
  }, [isPaused])

  useEffect(() => {
    const handleResize = () => {
      const nextRatio = window.devicePixelRatio || 1
      const nextScreen = {
        width: window.innerWidth,
        height: window.innerHeight,
      }
      screenRef.current = nextScreen
      setRatio(nextRatio)
      setScreen(nextScreen)

      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ type: 'resize', screen: nextScreen } satisfies ClientToServerMessage))
      }
    }

    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  useEffect(() => {
    const updateInput = (patch: Partial<InputState>) => {
      inputRef.current = { ...inputRef.current, ...patch }
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(
          JSON.stringify({ type: 'input', input: patch } satisfies ClientToServerMessage)
        )
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return
      }

      switch (event.code) {
        case 'Escape': {
          const pausing = !isPausedRef.current
          setPause(pausing)
          if (socketRef.current?.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({ type: pausing ? 'pause' : 'resume' } satisfies ClientToServerMessage))
          }
          break
        }
        case 'ArrowLeft':
        case 'KeyA':
          updateInput({ left: true })
          break
        case 'ArrowRight':
        case 'KeyD':
          updateInput({ right: true })
          break
        case 'ArrowUp':
        case 'KeyW':
          updateInput({ up: true })
          break
        case 'Space':
          updateInput({ space: true })
          break
      }
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      switch (event.code) {
        case 'ArrowLeft':
        case 'KeyA':
          updateInput({ left: false })
          break
        case 'ArrowRight':
        case 'KeyD':
          updateInput({ right: false })
          break
        case 'ArrowUp':
        case 'KeyW':
          updateInput({ up: false })
          break
        case 'Space':
          updateInput({ space: false })
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  return (
    <>
      <canvas
        ref={canvasRef}
        width={screen.width * ratio}
        height={screen.height * ratio}
        className={`block bg-black absolute inset-0 w-full h-full ${className || ''}`}
      />
      {connectionState !== 'open' && (
        <div className='fixed inset-0 flex items-center justify-center z-40 pointer-events-none'>
          <div className='font-mono text-xs uppercase tracking-widest text-white/50'>
            {connectionState === 'connecting'
            ? `Connecting to ${selectedLabel ?? 'game server'}…`
            : 'Game server disconnected'}
          </div>
        </div>
      )}
    </>
  )
}

export default ServerGameScreen
