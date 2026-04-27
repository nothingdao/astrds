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
import { particleSystem } from '@/game/systems/ParticleSystem'
import { audioService } from '@/services/audio/AudioService'
import { audioManager } from '@/services/audio/AudioManager'
import { ShipIcon } from '@/components/icons/GameIcons'
import { getAstrdsColor, getTokenColor, getTokenProtocolColor } from '@/lib/tokenColors'
import { resolveCanvasColor } from '@/lib/designTokens'
import { getCanvasTokens } from '@/lib/designTokens'
import { SHIELD_PICKUP_COLOR, RAPID_FIRE_PICKUP_COLOR } from '@shared/game/simulation'
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
  const snapshotRef = useRef<GameSnapshot | null>(null)
  const ratioRef = useRef(window.devicePixelRatio || 1)
  const prevAsteroidPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map())
  const prevShipRef = useRef<GameSnapshot['ship']>(null)
  const prevBulletCountRef = useRef(0)
  const prevPillsRef = useRef(0)
  const prevTokensRef = useRef(0)
  const prevThrustingRef = useRef(false)
  const levelTransitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [screen, setScreen] = useState<ScreenBounds>({
    width: window.innerWidth,
    height: window.innerHeight,
  })
  const screenRef = useRef<ScreenBounds>({
    width: window.innerWidth,
    height: window.innerHeight,
  })
  const [connectionState, setConnectionState] = useState<'connecting' | 'open' | 'closed'>('connecting')
  const [isRespawning, setIsRespawning] = useState(false)
  const [floatingTexts, setFloatingTexts] = useState<Array<{ id: number; x: number; y: number; text: string; color: string }>>([])
  const floatingIdRef = useRef(0)

  const setMachineState = useStateMachine((state) => state.setState)
  const setPause = useStateMachine((state) => state.setPause)
  const isPaused = useStateMachine((state) => state.isPaused)
  const isPausedRef = useRef(isPaused)
  isPausedRef.current = isPaused
  const selectedLabel = useServerStore((s) => s.selectedLabel)

  // Reset all game state on mount
  useEffect(() => {
    useGameData.getState().resetGame()
    useInventoryStore.getState().resetInventory()
    useLevelStore.getState().resetLevel()
    usePowerupStore.getState().deactivatePowerups()
    useSpaceTokenStore.getState().resetSession()
    particleSystem.update = particleSystem.update.bind(particleSystem)
  }, [])

  // rAF render loop — runs at display rate independent of server tick
  useEffect(() => {
    let animFrameId: number

    const loop = () => {
      const canvas = canvasRef.current
      const snap = snapshotRef.current
      if (canvas && snap) {
        const ctx = canvas.getContext('2d')
        if (ctx) {
          // Thruster particles — generated client-side from snapshot state
          if (snap.ship?.isThrusting && Math.random() > 0.5) {
            const r = (snap.ship.rotation * Math.PI) / 180
            particleSystem.createThrusterParticle(snap.ship.position, {
              x: -10 * Math.sin(r),
              y:  10 * Math.cos(r),
            })
          }
          particleSystem.update()
          renderServerSnapshot(ctx, snap, ratioRef.current)
          // Scale ctx to match ratio before rendering particles
          ctx.save()
          ctx.setTransform(ratioRef.current, 0, 0, ratioRef.current, 0, 0)
          particleSystem.render(ctx)
          ctx.restore()
        }
      }
      animFrameId = requestAnimationFrame(loop)
    }

    animFrameId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animFrameId)
  }, [])

  // WebSocket connection
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
      if (message.type !== 'state' && message.type !== 'welcome' && message.type !== 'gameOver') return

      const snap = message.snapshot
      const prev = snapshotRef.current

      // Detect events by diffing consecutive snapshots
      if (prev) {
        // Asteroid explosions
        const newAsteroidIds = new Set(snap.asteroids.map((a) => a.id))
        for (const a of prev.asteroids) {
          if (!newAsteroidIds.has(a.id)) {
            particleSystem.createExplosion(a.position, a.radius, 15)
            audioManager.playFromSfxBucket(
              a.radius >= 32 ? 'asteroidDestroyLarge' : a.radius >= 18 ? 'asteroidDestroyMedium' : 'asteroidDestroySmall'
            )
          }
        }

        // Ship death
        if (prev.ship && !snap.ship) {
          particleSystem.createExplosion(prev.ship.position, prev.ship.radius, 30)
          audioService.playSound('explosion')
        }

        // Bullets fired — each new bullet ID is a shot
        if (snap.bullets.length > prevBulletCountRef.current) {
          const newCount = snap.bullets.length - prevBulletCountRef.current
          for (let i = 0; i < newCount; i++) audioService.playSound('shoot')
        }

        // ASTRDS pills — diff prev.pills to get exact position, amount from emissionTier
        if (snap.pillsCollected > prevPillsRef.current) {
          audioService.playSound('collect')
          const pillDelta = snap.pillsCollected - prevPillsRef.current
          const astrdsPerPill = snap.emissionTier.astrdsPerPill
          const newPillIds = new Set(snap.pills.map((p) => p.id))
          let shown = 0
          for (const pill of prev.pills) {
            if (shown >= pillDelta) break
            if (!newPillIds.has(pill.id)) {
              shown++
              const id = ++floatingIdRef.current
              setFloatingTexts((ft) => [...ft.slice(-9), {
                id,
                x: pill.position.x,
                y: pill.position.y - pill.radius - 4,
                text: `+${astrdsPerPill} ASTRDS`,
                color: getAstrdsColor(),
              }])
            }
          }
        }

        // Tokens — diff prev.tokens for exact position; look up pool in activePools by color
        if (snap.tokensCollected > prevTokensRef.current) {
          audioManager.playFromSfxBucket('spaceTokenCollect')
          const delta = snap.tokensCollected - prevTokensRef.current
          const newTokenIds = new Set(snap.tokens.map((t) => t.id))
          const { activePools, recordCollection } = useSpaceTokenStore.getState()
          let shown = 0
          for (const token of prev.tokens) {
            if (shown >= delta) break
            if (!newTokenIds.has(token.id)) {
              shown++
              const pool = activePools.find((p) => getTokenProtocolColor(p.mintAddress) === token.color || getTokenColor(p.mintAddress) === token.color)
              let text: string
              if (pool) {
                recordCollection(pool)
                const displayAmt = pool.tokensPerPill / Math.pow(10, pool.decimals)
                const formatted = displayAmt % 1 === 0
                  ? displayAmt.toLocaleString()
                  : displayAmt.toLocaleString(undefined, { maximumFractionDigits: 4 })
                text = `+${formatted} ${pool.symbol}`
              } else {
                text = '+1'
              }
              const id = ++floatingIdRef.current
              setFloatingTexts((ft) => [...ft.slice(-9), {
                id,
                x: token.position.x,
                y: token.position.y - token.radius - 4,
                text,
                color: resolveCanvasColor(token.color),
              }])
            }
          }
        }

        // Powerup pickups — diff prev.powerupPickups for exact position and type
        const newPowerupIds = new Set(snap.powerupPickups.map((p) => p.id))
        for (const pickup of prev.powerupPickups) {
          if (!newPowerupIds.has(pickup.id)) {
            const isShield = pickup.color === SHIELD_PICKUP_COLOR
            const id = ++floatingIdRef.current
            setFloatingTexts((ft) => [...ft.slice(-9), {
              id,
              x: pickup.position.x,
              y: pickup.position.y - pickup.radius - 4,
              text: isShield ? 'SHIELD' : 'RAPID FIRE',
              color: resolveCanvasColor(pickup.color),
            }])
          }
        }

        // Ship pickup — diff prev.shipPickups for exact position
        if (snap.lives > prev.lives) {
          const newPickupIds = new Set(snap.shipPickups.map((s) => s.id))
          const collected = prev.shipPickups.find((s) => !newPickupIds.has(s.id))
          const pos = collected?.position ?? snap.ship?.position
          if (pos) {
            const id = ++floatingIdRef.current
            setFloatingTexts((ft) => [...ft.slice(-9), {
              id,
              x: pos.x,
              y: pos.y - 24,
              text: '+1 SHIP',
              color: getCanvasTokens().shipPickupFill,
            }])
          }
        }

        // Level transition
        if (snap.level !== prev.level) {
          if (levelTransitionTimerRef.current) clearTimeout(levelTransitionTimerRef.current)
          useLevelStore.setState({ level: snap.level, isLevelTransition: true })
          levelTransitionTimerRef.current = setTimeout(() => {
            useLevelStore.setState({ isLevelTransition: false })
          }, 2000)
        } else {
          useLevelStore.setState({ level: snap.level })
        }
      } else {
        useLevelStore.setState({ level: snap.level })
      }

      // Thruster loop — start/stop when thrust state changes
      const nowThrusting = snap.ship?.isThrusting ?? false
      if (nowThrusting && !prevThrustingRef.current) audioService.playSoundLoop('thrust')
      if (!nowThrusting && prevThrustingRef.current) audioService.stopSoundLoop('thrust')
      prevThrustingRef.current = nowThrusting

      prevBulletCountRef.current = snap.bullets.length
      prevPillsRef.current = snap.pillsCollected
      prevTokensRef.current = snap.tokensCollected

      // Respawn overlay — ship just appeared with invulnerability
      const wasInvulnerable = prevShipRef.current?.isInvulnerable ?? false
      const nowInvulnerable = snap.ship?.isInvulnerable ?? false
      if (!wasInvulnerable && nowInvulnerable) {
        setIsRespawning(true)
      } else if (wasInvulnerable && !nowInvulnerable) {
        setIsRespawning(false)
      }

      prevShipRef.current = snap.ship
      snapshotRef.current = snap

      // Store updates
      useGameData.getState().updateScore(snap.score)
      useInventoryStore.setState({
        items: {
          ships: snap.lives,
          tokens: snap.tokensCollected,
          pills: snap.pillsCollected,
        },
        astrdsEarned: Math.floor(snap.pillsCollected * snap.emissionTier.astrdsPerPill),
      })
      usePowerupStore.setState({
        powerups: {
          invincible: snap.powerups.invincible,
          rapidFire: snap.powerups.rapidFire,
        },
        powerupExpiresAt: snap.powerups.expiresAt,
      })

      // Track asteroid positions for next frame's explosion detection
      prevAsteroidPositionsRef.current = new Map(snap.asteroids.map((a) => [a.id, a.position]))

      if (snap.status === 'gameOver') {
        setMachineState(MachineState.GAME_OVER)
      }
    })

    socket.addEventListener('close', () => {
      setConnectionState('closed')
      audioService.stopSoundLoop('thrust')
    })

    socket.addEventListener('error', () => {
      setConnectionState('closed')
    })

    return () => {
      socket.close()
      socketRef.current = null
    }
  }, [])

  // Sync pause state to server whenever it changes
  useEffect(() => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return
    socketRef.current.send(JSON.stringify({ type: isPaused ? 'pause' : 'resume' } satisfies ClientToServerMessage))
  }, [isPaused])

  // Window resize
  useEffect(() => {
    const handleResize = () => {
      const nextRatio = window.devicePixelRatio || 1
      const nextScreen = { width: window.innerWidth, height: window.innerHeight }
      ratioRef.current = nextRatio
      screenRef.current = nextScreen
      setScreen(nextScreen)
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ type: 'resize', screen: nextScreen } satisfies ClientToServerMessage))
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Keyboard input
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
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return
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
        case 'KeyA': updateInput({ left: true }); break
        case 'ArrowRight':
        case 'KeyD': updateInput({ right: true }); break
        case 'ArrowUp':
        case 'KeyW': updateInput({ up: true }); break
        case 'Space': updateInput({ space: true }); break
      }
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      switch (event.code) {
        case 'ArrowLeft':
        case 'KeyA': updateInput({ left: false }); break
        case 'ArrowRight':
        case 'KeyD': updateInput({ right: false }); break
        case 'ArrowUp':
        case 'KeyW': updateInput({ up: false }); break
        case 'Space': updateInput({ space: false }); break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  const lives = snapshotRef.current?.lives ?? 0

  return (
    <>
      <canvas
        ref={canvasRef}
        width={screen.width * ratioRef.current}
        height={screen.height * ratioRef.current}
        className={`block bg-[var(--canvas-background)] absolute inset-0 w-full h-full ${className || ''}`}
      />

      {connectionState !== 'open' && (
        <div className='fixed inset-0 flex items-center justify-center z-40 pointer-events-none'>
          <div className='font-mono text-xs uppercase tracking-widest text-muted-foreground'>
            {connectionState === 'connecting'
              ? `Connecting to ${selectedLabel ?? 'game server'}…`
              : 'Game server disconnected'}
          </div>
        </div>
      )}

      {isRespawning && lives > 0 && (
        <div className='fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none'>
          <div className='bg-surface-overlay px-6 py-4 border border-edge-accent animate-fadeIn flex flex-col items-center gap-3'>
            <ShipIcon className='text-tx-accent opacity-50 animate-[spin_2s_linear_infinite]' />
            <div className='text-xl text-tx-accent font-bold animate-pulse font-mono uppercase tracking-widest'>
              Ship Deployed
            </div>
            <div className='text-sm text-tx-primary font-mono'>
              {lives} {lives === 1 ? 'Ship' : 'Ships'} Remaining
            </div>
          </div>
        </div>
      )}

      {floatingTexts.map((ft) => (
        <div
          key={ft.id}
          className='fixed pointer-events-none z-30 font-mono text-xs font-bold'
          style={{
            left: ft.x,
            top: ft.y,
            color: ft.color,
            animation: 'floatUp 1.2s ease-out forwards',
          }}
          onAnimationEnd={() =>
            setFloatingTexts((prev) => prev.filter((t) => t.id !== ft.id))
          }
        >
          {ft.text}
        </div>
      ))}
    </>
  )
}

export default ServerGameScreen
