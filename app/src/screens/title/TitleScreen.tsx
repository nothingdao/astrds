import React, { memo, useCallback, useState, useEffect } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useStateMachine } from '@/stores/stateMachine'
import { useServerStore } from '@/stores/serverStore'
import { QuarterButton } from '@/components/common/Buttons'
import { MachineState } from '@/types/machine'
import { authService } from '@/auth/AuthService'
import ScreenContainer from '@/components/common/ScreenContainer'

type ServerEntry = {
  id: string
  label: string
  url: string
}

type ServerWithStatus = ServerEntry & {
  ping: number | null
  online: boolean | null
}

async function probeServer(wsUrl: string): Promise<{ online: boolean; ping: number | null }> {
  const httpUrl = wsUrl.startsWith('wss://')
    ? wsUrl.replace('wss://', 'https://')
    : wsUrl.replace('ws://', 'http://')
  const start = performance.now()
  try {
    const res = await fetch(httpUrl, { signal: AbortSignal.timeout(3000) })
    const ping = Math.round(performance.now() - start)
    return { online: res.ok, ping }
  } catch {
    return { online: false, ping: null }
  }
}

const PingDot: React.FC<{ online: boolean | null; ping: number | null }> = ({ online, ping }) => {
  if (online === null) return <span className='w-1.5 h-1.5 rounded-full bg-surface-subtle animate-pulse inline-block' />
  if (!online) return <span className='w-1.5 h-1.5 rounded-full bg-destructive/50 inline-block' />
  if (ping !== null && ping < 80) return <span className='w-1.5 h-1.5 rounded-full bg-[var(--text-success)] inline-block' />
  if (ping !== null && ping < 150) return <span className='w-1.5 h-1.5 rounded-full bg-[var(--text-warning)] inline-block' />
  return <span className='w-1.5 h-1.5 rounded-full bg-destructive inline-block' />
}

const TitleScreen: React.FC = () => {
  const wallet = useWallet()
  const gameState = useStateMachine()
  const [isPaying, setIsPaying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [servers, setServers] = useState<ServerWithStatus[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const setSelected = useServerStore((s) => s.setSelected)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const res = await fetch('/servers.json')
      const list: ServerEntry[] = await res.json()

      const entries: ServerEntry[] = import.meta.env.DEV
        ? [{ id: 'local', label: 'Local Dev', url: 'ws://localhost:3001' }, ...list]
        : list

      if (!cancelled) {
        setServers(entries.map((e) => ({ ...e, ping: null, online: null })))
      }

      const results = await Promise.all(
        entries.map(async (entry) => {
          const status = await probeServer(entry.url)
          return { ...entry, ...status }
        })
      )

      if (!cancelled) {
        setServers(results)
        const first = results.find((r) => r.online)
        if (first) {
          setSelectedId(first.id)
          setSelected(first.url, first.label)
        }
      }
    }

    load().catch(console.error)
    return () => {
      cancelled = true
    }
  }, [setSelected])

  const handleSelect = useCallback(
    (server: ServerWithStatus) => {
      if (!server.online) return
      setSelectedId(server.id)
      setSelected(server.url, server.label)
    },
    [setSelected]
  )

  const handlePlay = useCallback(async () => {
    if (!wallet.connected || isPaying || !selectedId) return
    setIsPaying(true)
    setError(null)
    try {
      await authService.verifyWalletSignature(wallet, 'SOL')
      await gameState.startTransition(MachineState.INITIAL, MachineState.READY_TO_PLAY)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Payment failed')
    } finally {
      setIsPaying(false)
    }
  }, [wallet, isPaying, selectedId, gameState])

  return (
    <ScreenContainer screenType='INITIAL' mode='fullscreen' className='overflow-hidden'>

      {/* Gradient overlays */}
      <div className='absolute inset-0 bg-gradient-to-b from-background/70 via-background/20 to-background/85' />
      <div className='absolute inset-0 bg-gradient-to-t from-transparent via-transparent to-background/50' />

      {/* Scanlines */}
      <div
        className='absolute inset-0 pointer-events-none opacity-30'
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent, transparent 3px, var(--surface-overlay) 3px, var(--surface-overlay) 4px)',
        }}
      />

      {/* Perspective grid at bottom */}
      <div className='absolute bottom-0 left-0 right-0 h-64 overflow-hidden pointer-events-none'>
        <div
          className='absolute inset-0 opacity-20'
          style={{
            backgroundImage:
              'linear-gradient(color-mix(in srgb, var(--primary) 60%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--primary) 60%, transparent) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
            transform: 'perspective(400px) rotateX(70deg)',
            transformOrigin: 'bottom center',
          }}
        />
        <div className='absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-background/60' />
      </div>

      {/* Main layout */}
      <div className='absolute inset-0 flex flex-col items-center justify-between pt-28 pb-12 px-8'>

        {/* Top: studio credit */}
        <div className='text-center'>
          <p className='font-mono text-xs text-tx-dim uppercase tracking-[0.5em]'>
            nothingdao presents
          </p>
        </div>

        {/* Center: title block */}
        <div className='text-center flex flex-col items-center gap-6'>
          <h1
            className='font-mono font-black uppercase leading-none text-foreground select-none'
            style={{
              fontSize: 'clamp(5rem, 18vw, 16rem)',
              letterSpacing: '0.05em',
              textShadow: 'var(--text-shadow-accent-glow)',
              animation: 'glow 2s ease-in-out infinite alternate',
            }}
          >
            ASTRDS
          </h1>

          <p className='font-mono text-xl text-tx-tertiary uppercase tracking-[0.7em]'>
            mine &nbsp;·&nbsp; survive &nbsp;·&nbsp; or die trying
          </p>

          {/* Flavor badges */}
          <div className='flex items-center gap-3 mt-2 flex-wrap justify-center'>
            {['Token-2022', 'Solana Devnet', 'Mine $ASTRDS'].map((badge) => (
              <span
                key={badge}
                className='font-mono text-[10px] text-primary/50 uppercase tracking-widest border border-primary/15 px-3 py-1'
              >
                {badge}
              </span>
            ))}
          </div>
        </div>

        {/* Server picker */}
        <div className='flex flex-col items-center gap-2'>
          <p className='font-mono text-[9px] text-tx-dim uppercase tracking-[0.5em] mb-1'>Select Server</p>
          <div className='flex gap-2 flex-wrap justify-center'>
            {servers.map((server) => (
              <button
                key={server.id}
                onClick={() => handleSelect(server)}
                disabled={server.online === false}
                className={`font-mono text-[9px] uppercase tracking-widest px-3 py-2 border transition-colors flex items-center gap-2 min-w-[120px] ${
                  server.online === false
                    ? 'border-edge-subtle text-tx-dim cursor-not-allowed'
                    : selectedId === server.id
                    ? 'border-primary/60 text-primary bg-primary/10'
                    : 'border-border text-muted-foreground hover:border-edge-medium hover:text-tx-secondary'
                }`}
              >
                <PingDot online={server.online} ping={server.ping} />
                <span className='flex-1 text-left'>{server.label}</span>
                {server.online === false ? (
                  <span className='text-destructive/60'>offline</span>
                ) : server.ping !== null ? (
                  <span className='opacity-40'>{server.ping}ms</span>
                ) : (
                  <span className='opacity-20'>...</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Bottom: CTA */}
        <div className='flex flex-col items-center gap-4'>
          {wallet.connected ? (
            <>
              <QuarterButton onClick={handlePlay} disabled={isPaying || !selectedId}>
                {isPaying ? 'Sending $0.25...' : 'Insert Quarter'}
              </QuarterButton>
              <p className='font-mono text-[10px] text-tx-dim uppercase tracking-widest'>
                $0.25 in SOL per play
              </p>
            </>
          ) : (
            <p className='font-mono text-primary/50 uppercase tracking-[0.4em] text-sm animate-pulse'>
              — Connect wallet to play —
            </p>
          )}

          {error && (
            <p className='font-mono text-destructive/80 text-xs text-center max-w-xs'>
              {error}
            </p>
          )}

          <p className='font-mono text-[10px] text-foreground/12 uppercase tracking-[0.4em]'>
            © 2025 nothingdao
          </p>
        </div>
      </div>
    </ScreenContainer>
  )
}

export default memo(TitleScreen)
