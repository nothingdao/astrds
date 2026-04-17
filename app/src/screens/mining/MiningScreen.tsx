import React from 'react'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { Rocket, Plus } from 'lucide-react'
import { useOverlayStore } from '@/stores/overlayStore'
import { Overlay } from '@/types/overlay'

const MiningScreen = ({ onClose }: { onClose: () => void }) => {
  const activeDeposits = useQuery(api.spaceDeposits.getAllActiveSpaceDeposits)
  const openOverlay = useOverlayStore((state) => state.openOverlay)

  const handleDeposit = () => {
    onClose()
    openOverlay(Overlay.SPACE)
  }

  return (
    <div className='p-5 space-y-4'>

      <div className='flex items-center justify-between'>
        <p className='font-mono text-[10px] text-white/30'>
          Third parties deposit any SPL token into the asteroid field. Players collect and claim on game over — all on-chain.
        </p>
        <button
          onClick={handleDeposit}
          className='flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-game-blue/60 border border-game-blue/20 px-3 py-1.5 hover:border-game-blue/50 hover:text-game-blue transition-colors shrink-0 ml-4'
        >
          <Plus size={11} />
          Deposit
        </button>
      </div>

      {!activeDeposits ? (
        <div className='font-mono text-[10px] text-white/20 text-center py-12'>Loading...</div>
      ) : activeDeposits.length === 0 ? (
        <div className='border border-white/5 rounded-lg p-8 text-center space-y-3'>
          <Rocket size={24} className='text-white/10 mx-auto' />
          <p className='font-mono text-xs text-white/30'>No tokens in the asteroid field right now.</p>
          <p className='font-mono text-[10px] text-white/20'>Be the first to launch some.</p>
          <button
            onClick={handleDeposit}
            className='font-mono text-[10px] uppercase tracking-widest text-game-blue/60 border border-game-blue/20 px-4 py-2 hover:border-game-blue/50 hover:text-game-blue transition-colors mt-2'
          >
            Launch Tokens into Space
          </button>
        </div>
      ) : (
        <div className='space-y-2'>
          {activeDeposits.map((d) => {
            const remaining = d.remainingAmount / 10 ** (d.decimals ?? 0)
            const total = d.totalAmount / 10 ** (d.decimals ?? 0)
            const pct = total > 0 ? remaining / total : 0
            return (
              <div key={d._id} className='border border-white/5 rounded-lg p-4 hover:border-white/10 transition-colors'>
                <div className='flex items-center justify-between mb-3'>
                  <div className='flex items-center gap-3'>
                    {d.logoUri ? (
                      <img src={d.logoUri} alt={d.symbol} className='w-7 h-7 rounded-full object-cover' />
                    ) : (
                      <div className='w-7 h-7 rounded-full bg-purple-500/20 flex items-center justify-center'>
                        <span className='text-[8px] font-mono text-purple-400'>{d.symbol.slice(0, 2)}</span>
                      </div>
                    )}
                    <div>
                      <div className='font-mono text-sm text-white/80'>{d.symbol}</div>
                      <div className='font-mono text-[10px] text-white/30'>{d.name}</div>
                    </div>
                  </div>
                  <div className='text-right font-mono text-xs'>
                    <div className='text-purple-300/70'>
                      {remaining.toLocaleString(undefined, { maximumFractionDigits: 2 })} remaining
                    </div>
                    <div className='text-white/25 text-[10px]'>
                      of {total.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>

                {/* Depletion bar */}
                <div className='w-full h-0.5 bg-white/5 rounded-full overflow-hidden mb-2'>
                  <div
                    className='h-full bg-purple-400/50 transition-all duration-500'
                    style={{ width: `${pct * 100}%` }}
                  />
                </div>

                <div className='flex items-center justify-between font-mono text-[9px] text-white/20'>
                  <span>{(d.tokensPerPill / 10 ** (d.decimals ?? 0)).toLocaleString(undefined, { maximumFractionDigits: 2 })} per pill</span>
                  <span>Levels {d.minLevel}–{d.maxLevel}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default MiningScreen
