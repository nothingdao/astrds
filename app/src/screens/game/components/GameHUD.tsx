// src/screens/game/components/GameHUD.tsx
import React, { useEffect, useState } from 'react'
import { useGameData } from '@/stores/gameData'
import { useLevelStore } from '@/stores/levelStore'
import { useInventoryStore } from '@/stores/inventoryStore'
import { usePowerupStore } from '@/stores/powerupStore'
import { useSpaceTokenStore } from '@/stores/spaceTokenStore'
import { ShipIcon, PillIcon } from '@/components/icons/GameIcons'
import { Shield, Zap } from 'lucide-react'
import { useServerStore } from '@/stores/serverStore'
import { useWallet } from '@solana/wallet-adapter-react'
import { useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import AvatarDisplay from '@/components/common/AvatarDisplay'
import AudioWidget from '@/components/common/AudioWidget'

const POWERUP_DURATION = 10_000

export const GameHUD: React.FC = () => {
  const score = useGameData((state) => state.score)
  const level = useLevelStore((state) => state.level)
  const items = useInventoryStore((state) => state.items)
  const astrdsEarned = useInventoryStore((state) => state.astrdsEarned)
  const powerups = usePowerupStore((state) => state.powerups)
  const powerupExpiresAt = usePowerupStore((state) => state.powerupExpiresAt)
  const spaceCollected = useSpaceTokenStore((s) => s.collectedThisSession)
  const selectedLabel = useServerStore((s) => s.selectedLabel)
  const [powerupProgress, setPowerupProgress] = useState(0)
  const wallet = useWallet()
  const walletAddress = wallet.publicKey?.toString() ?? ''
  const avatarUrl = useQuery(
    api.players.getAvatarUrl,
    walletAddress ? { walletAddress } : 'skip'
  )

  const anyPowerupActive = powerups.invincible || powerups.rapidFire

  useEffect(() => {
    if (!anyPowerupActive || !powerupExpiresAt) {
      setPowerupProgress(0)
      return
    }

    const update = () => {
      const remaining = powerupExpiresAt - Date.now()
      setPowerupProgress(Math.max(0, remaining / POWERUP_DURATION))
    }

    update()
    const id = setInterval(update, 50)
    return () => clearInterval(id)
  }, [anyPowerupActive, powerupExpiresAt])

  return (
    <>
      {/* Top strip: score | level | lives */}
      <div className='fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-6 py-3 pointer-events-none'>
        {/* Score + avatar */}
        <div className='flex items-center gap-3'>
          <AvatarDisplay url={avatarUrl} address={walletAddress} size={28} />
          <div>
            <div className='font-mono text-lg leading-none text-primary'>
              {score.toLocaleString()}
            </div>
            <div className='font-mono text-xs text-muted-foreground mt-0.5'>SCORE</div>
          </div>
        </div>

        {/* Level + server + audio widget */}
        <div className='flex flex-col items-center gap-1'>
          <div className='text-center'>
            <div className='font-mono text-lg leading-none text-primary'>{level}</div>
            <div className='font-mono text-xs text-muted-foreground mt-0.5'>LEVEL</div>
          </div>
          {selectedLabel && (
            <div className='font-mono text-[9px] text-tx-dim uppercase tracking-widest'>
              {selectedLabel}
            </div>
          )}
          <AudioWidget compact />
        </div>

        {/* Ship lives */}
        <div className='flex items-center gap-1.5'>
          {items.ships > 0
            ? Array.from({ length: Math.min(items.ships, 6) }).map((_, i) => (
                <ShipIcon key={i} className='w-5 h-5 text-primary' />
              ))
            : <span className='font-mono text-xs text-tx-dim'>NO LIVES</span>
          }
        </div>
      </div>

      {/* Bottom strip: pills | powerup slots | tokens */}
      <div className='fixed bottom-0 left-0 right-0 z-40 flex items-center justify-between px-6 py-3 pointer-events-none'>
        {/* Pills */}
        <div className='flex items-center gap-2'>
          <PillIcon
            className='w-5 h-5'
            style={{ color: items.pills > 0 ? 'var(--entity-pill)' : 'var(--text-dim)' }}
          />
          <span
            className='font-mono text-sm'
            style={{ color: items.pills > 0 ? 'var(--entity-pill)' : 'var(--text-dim)' }}
          >
            ×{items.pills}
          </span>
        </div>

        {/* Powerup slots */}
        <div className='flex items-center gap-5'>
          {/* Shield slot */}
          <div className={`flex flex-col items-center gap-1 transition-opacity duration-300 ${powerups.invincible ? 'opacity-100' : 'opacity-20'}`}>
            <Shield
              size={16}
              className={powerups.invincible ? 'text-primary' : 'text-tx-primary'}
            />
            <div className='w-14 h-1 bg-surface-subtle rounded-full overflow-hidden'>
              <div
                className='h-full bg-primary rounded-full'
                style={{
                  width: powerups.invincible ? `${powerupProgress * 100}%` : '0%',
                  transition: powerups.invincible ? 'none' : undefined,
                }}
              />
            </div>
          </div>

          {/* Rapid fire slot */}
          <div className={`flex flex-col items-center gap-1 transition-opacity duration-300 ${powerups.rapidFire ? 'opacity-100' : 'opacity-20'}`}>
            <Zap
              size={16}
              className={powerups.rapidFire ? 'text-primary' : 'text-tx-primary'}
            />
            <div className='w-14 h-1 bg-surface-subtle rounded-full overflow-hidden'>
              <div
                className='h-full bg-primary rounded-full'
                style={{
                  width: powerups.rapidFire ? `${powerupProgress * 100}%` : '0%',
                  transition: powerups.rapidFire ? 'none' : undefined,
                }}
              />
            </div>
          </div>
        </div>

        {/* Token counters — ASTRDS + any space tokens collected */}
        <div className='flex items-center gap-3'>
          {spaceCollected.map((c) => (
            <div key={c.depositId} className='flex items-center gap-1.5'>
              <span
                className='w-2.5 h-2.5 rounded-full inline-block shrink-0'
                style={{ backgroundColor: c.color }}
              />
              <span className='font-mono text-sm' style={{ color: c.color }}>
                {c.symbol} ×{c.pillCount}
              </span>
            </div>
          ))}
          <div className='flex items-center gap-2'>
            <img
              src='/astrds.png'
              alt='ASTRDS'
              className='w-5 h-5 rounded-full object-cover'
            />
            <span className='font-mono text-sm' style={{ color: 'var(--entity-pill)' }}>
              ×{astrdsEarned}
            </span>
          </div>
        </div>
      </div>
    </>
  )
}
