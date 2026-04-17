import React, { memo, useCallback, useState, useEffect } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useStateMachine } from '@/stores/stateMachine'
import { QuarterButton } from '@/components/common/Buttons'
import { MachineState } from '@/types/machine'
import { authService } from '@/auth/AuthService'

const MAX_CAPACITY = 50

type Region = {
  id: string
  label: string
  city: string
  ping: number | null
  players: number | null
}

const REGIONS: Region[] = [
  { id: 'us-west', label: 'US West', city: 'Oregon', ping: null, players: null },
  { id: 'us-east', label: 'US East', city: 'Virginia', ping: null, players: null },
  { id: 'eu-west', label: 'EU West', city: 'Amsterdam', ping: null, players: null },
  { id: 'ap-sea', label: 'Asia Pacific', city: 'Singapore', ping: null, players: null },
]

const PingDot: React.FC<{ ping: number | null }> = ({ ping }) => {
  if (ping === null) return <span className='w-1.5 h-1.5 rounded-full bg-white/20 animate-pulse inline-block' />
  if (ping < 80) return <span className='w-1.5 h-1.5 rounded-full bg-green-400 inline-block' />
  if (ping < 150) return <span className='w-1.5 h-1.5 rounded-full bg-yellow-400 inline-block' />
  return <span className='w-1.5 h-1.5 rounded-full bg-red-400 inline-block' />
}

const CapacityBar: React.FC<{ players: number | null }> = ({ players }) => {
  if (players === null) return (
    <div className='w-16 h-1 bg-white/10 rounded-full overflow-hidden'>
      <div className='h-full w-full bg-white/10 animate-pulse' />
    </div>
  )
  const pct = players / MAX_CAPACITY
  const color = pct > 0.8 ? 'bg-red-400' : pct > 0.5 ? 'bg-yellow-400' : 'bg-green-400'
  return (
    <div className='w-16 h-1 bg-white/10 rounded-full overflow-hidden'>
      <div className={`h-full ${color} transition-all duration-500`} style={{ width: `${pct * 100}%` }} />
    </div>
  )
}

const TitleScreen: React.FC = () => {
  const wallet = useWallet()
  const gameState = useStateMachine()
  const [isPaying, setIsPaying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [regions, setRegions] = useState(REGIONS)
  const [selectedRegion, setSelectedRegion] = useState('us-west')

  useEffect(() => {
    const fakePing = (base: number) => base + Math.floor(Math.random() * 20)
    const fakePlayers = (max: number) => Math.floor(Math.random() * max)
    const timer = setTimeout(() => {
      setRegions([
        { id: 'us-west', label: 'US West', city: 'Oregon', ping: fakePing(18), players: fakePlayers(40) },
        { id: 'us-east', label: 'US East', city: 'Virginia', ping: fakePing(42), players: fakePlayers(25) },
        { id: 'eu-west', label: 'EU West', city: 'Amsterdam', ping: fakePing(110), players: fakePlayers(15) },
        { id: 'ap-sea', label: 'Asia Pacific', city: 'Singapore', ping: fakePing(190), players: fakePlayers(8) },
      ])
    }, 1200)
    return () => clearTimeout(timer)
  }, [])

  const handlePlay = useCallback(async () => {
    if (!wallet.connected || isPaying) return
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
  }, [wallet, isPaying, gameState])

  return (
    <div className='fixed inset-0 overflow-hidden bg-black'>
      {/* Background image */}
      <div
        className='absolute inset-0 bg-cover bg-center bg-no-repeat'
        style={{ backgroundImage: "url('/assets/wojak-on-moon.png')" }}
      />

      {/* Gradient overlays */}
      <div className='absolute inset-0 bg-gradient-to-b from-black/80 via-black/30 to-black/95' />
      <div className='absolute inset-0 bg-gradient-to-t from-transparent via-transparent to-black/60' />

      {/* Scanlines */}
      <div
        className='absolute inset-0 pointer-events-none opacity-30'
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.4) 3px, rgba(0,0,0,0.4) 4px)',
        }}
      />

      {/* Perspective grid at bottom */}
      <div className='absolute bottom-0 left-0 right-0 h-64 overflow-hidden pointer-events-none'>
        <div
          className='absolute inset-0 opacity-20'
          style={{
            backgroundImage:
              'linear-gradient(rgba(77,193,249,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(77,193,249,0.6) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
            transform: 'perspective(400px) rotateX(70deg)',
            transformOrigin: 'bottom center',
          }}
        />
        <div className='absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/80' />
      </div>

      {/* Main layout */}
      <div className='absolute inset-0 flex flex-col items-center justify-between pt-28 pb-12 px-8'>

        {/* Top: studio credit */}
        <div className='text-center'>
          <p className='font-mono text-xs text-white/25 uppercase tracking-[0.5em]'>
            nothingdao presents
          </p>
        </div>

        {/* Center: title block */}
        <div className='text-center flex flex-col items-center gap-6'>
          <h1
            className='font-mono font-black uppercase leading-none text-white select-none'
            style={{
              fontSize: 'clamp(5rem, 18vw, 16rem)',
              letterSpacing: '0.05em',
              textShadow:
                '0 0 30px #4dc1f9, 0 0 60px #4dc1f9, 0 0 100px #4dc1f9, 0 0 200px rgba(77,193,249,0.4)',
              animation: 'glow 2s ease-in-out infinite alternate',
            }}
          >
            ASTRDS
          </h1>

          <p className='font-mono text-xl text-white/35 uppercase tracking-[0.7em]'>
            mine &nbsp;·&nbsp; survive &nbsp;·&nbsp; or die trying
          </p>

          {/* Flavor badges */}
          <div className='flex items-center gap-3 mt-2 flex-wrap justify-center'>
            {['Token-2022', 'Solana Devnet', 'Mine $ASTRDS'].map((badge) => (
              <span
                key={badge}
                className='font-mono text-[10px] text-game-blue/50 uppercase tracking-widest border border-game-blue/15 px-3 py-1'
              >
                {badge}
              </span>
            ))}
          </div>
        </div>

        {/* Region picker */}
        <div className='flex flex-col items-center gap-2'>
          <p className='font-mono text-[9px] text-white/20 uppercase tracking-[0.5em] mb-1'>Select Server</p>
          <div className='flex gap-2 flex-wrap justify-center'>
            {regions.map((r) => {
              const full = r.players !== null && r.players >= MAX_CAPACITY
              return (
                <button
                  key={r.id}
                  onClick={() => !full && setSelectedRegion(r.id)}
                  disabled={full}
                  className={`font-mono text-[9px] uppercase tracking-widest px-3 py-2 border transition-colors flex flex-col gap-1.5 text-left min-w-[120px] ${
                    full
                      ? 'border-white/5 text-white/15 cursor-not-allowed'
                      : selectedRegion === r.id
                      ? 'border-game-blue/60 text-game-blue bg-game-blue/10'
                      : 'border-white/10 text-white/30 hover:border-white/25 hover:text-white/50'
                  }`}
                >
                  <div className='flex items-center justify-between w-full gap-3'>
                    <div className='flex items-center gap-1.5'>
                      <PingDot ping={r.ping} />
                      <span>{r.label}</span>
                    </div>
                    {full ? (
                      <span className='text-red-400/60'>FULL</span>
                    ) : r.ping !== null ? (
                      <span className='text-white/20'>{r.ping}ms</span>
                    ) : null}
                  </div>
                  <div className='flex items-center gap-2 w-full'>
                    <CapacityBar players={r.players} />
                    <span className='text-white/20 text-[8px]'>
                      {r.players !== null ? `${r.players}/${MAX_CAPACITY}` : '...'}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Bottom: CTA */}
        <div className='flex flex-col items-center gap-4'>
          {wallet.connected ? (
            <>
              <QuarterButton onClick={handlePlay} disabled={isPaying}>
                {isPaying ? 'Sending $0.25...' : 'Insert Quarter'}
              </QuarterButton>
              <p className='font-mono text-[10px] text-white/20 uppercase tracking-widest'>
                $0.25 in SOL per play
              </p>
            </>
          ) : (
            <p className='font-mono text-game-blue/50 uppercase tracking-[0.4em] text-sm animate-pulse'>
              — Connect wallet to play —
            </p>
          )}

          {error && (
            <p className='font-mono text-red-400/80 text-xs text-center max-w-xs'>
              {error}
            </p>
          )}

          <p className='font-mono text-[10px] text-white/12 uppercase tracking-[0.4em]'>
            © 2025 nothingdao
          </p>
        </div>
      </div>
    </div>
  )
}

export default memo(TitleScreen)
