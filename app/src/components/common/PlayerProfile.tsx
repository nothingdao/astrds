import React from 'react'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { Copy, Check } from 'lucide-react'

const short = (addr: string) => `${addr.slice(0, 4)}...${addr.slice(-4)}`

const CopyAddress: React.FC<{ address: string }> = ({ address }) => {
  const [copied, setCopied] = React.useState(false)
  const copy = () => {
    navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button onClick={copy} className='flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground hover:text-tx-secondary transition-colors'>
      {short(address)}
      {copied ? <Check size={10} className='text-tx-success' /> : <Copy size={10} />}
    </button>
  )
}

const PlayerProfile: React.FC<{ address: string }> = ({ address }) => {
  const deposits = useQuery(api.spaceDeposits.getDepositsByWallet, { walletAddress: address })
  const claims = useQuery(api.spaceDeposits.getClaimsByWallet, { playerWalletAddress: address })
  const scores = useQuery(api.scores.getScores)

  const topScore = scores?.find((s) => s.walletAddress === address)
  const activeDeposits = deposits?.filter((d) => d.status === 'active' && d.remainingAmount > 0) ?? []
  const totalDeposited = deposits?.length ?? 0

  return (
    <div className='p-5 space-y-5'>

      {/* Identity */}
      <div className='flex items-center gap-3 pb-4 border-b border-edge-subtle'>
        <div className='w-10 h-10 rounded-full bg-surface-subtle flex items-center justify-center font-mono text-xs text-muted-foreground'>
          {address.slice(0, 2)}
        </div>
        <div>
          <CopyAddress address={address} />
          <div className='font-mono text-[9px] text-tx-dim mt-0.5'>Solana wallet</div>
        </div>
        {topScore && (
          <div className='ml-auto text-right'>
            <div className='font-mono text-xs text-primary'>{topScore.score.toLocaleString()}</div>
            <div className='font-mono text-[9px] text-tx-dim'>top score</div>
          </div>
        )}
      </div>

      {/* Stats row */}
      <div className='grid grid-cols-3 gap-3'>
        {[
          { label: 'Deposits', value: totalDeposited },
          { label: 'Active Pools', value: activeDeposits.length },
          { label: 'Claims', value: claims?.length ?? '...' },
        ].map(({ label, value }) => (
          <div key={label} className='border border-edge-subtle rounded p-3 text-center'>
            <div className='font-mono text-lg text-tx-secondary'>{value}</div>
            <div className='font-mono text-[9px] text-tx-dim uppercase tracking-widest mt-0.5'>{label}</div>
          </div>
        ))}
      </div>

      {/* Active deposits */}
      {activeDeposits.length > 0 && (
        <div className='space-y-2'>
          <div className='font-mono text-[9px] text-tx-dim uppercase tracking-widest'>Active in Space</div>
          {activeDeposits.map((d) => {
            const remaining = d.remainingAmount / 10 ** (d.decimals ?? 0)
            const total = d.totalAmount / 10 ** (d.decimals ?? 0)
            const pct = total > 0 ? remaining / total : 0
            return (
              <div key={d._id} className='flex items-center justify-between border border-edge-subtle rounded p-3'>
                <div className='flex items-center gap-2'>
                  {d.logoUri
                    ? <img src={d.logoUri} alt={d.symbol} className='w-5 h-5 rounded-full object-cover' />
                    : <div className='w-5 h-5 rounded-full bg-[var(--entity-shield)]/15 flex items-center justify-center'><span className='text-[7px] font-mono text-[var(--entity-shield)]'>{d.symbol?.slice(0, 2)}</span></div>
                  }
                  <span className='font-mono text-xs text-tx-secondary'>{d.symbol}</span>
                </div>
                <div className='flex items-center gap-3'>
                  <div className='w-16 h-0.5 bg-surface-subtle rounded-full overflow-hidden'>
                    <div className='h-full bg-[var(--entity-shield)]/50' style={{ width: `${pct * 100}%` }} />
                  </div>
                  <span className='font-mono text-[10px] text-muted-foreground w-20 text-right'>
                    {remaining.toLocaleString(undefined, { maximumFractionDigits: 2 })} left
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Claim history */}
      {claims && claims.length > 0 && (
        <div className='space-y-2'>
          <div className='font-mono text-[9px] text-tx-dim uppercase tracking-widest'>Claim History</div>
          {claims.slice(0, 10).map((c) => {
            const amount = c.amount / 10 ** (c.decimals ?? 0)
            return (
              <div key={c._id} className='flex items-center justify-between border border-edge-subtle rounded p-3'>
                <div className='flex items-center gap-2'>
                  {c.logoUri
                    ? <img src={c.logoUri} alt={c.symbol} className='w-4 h-4 rounded-full object-cover' />
                    : <div className='w-4 h-4 rounded-full bg-[var(--entity-shield)]/15' />
                  }
                  <span className='font-mono text-[10px] text-tx-secondary'>{c.symbol}</span>
                </div>
                <span className='font-mono text-[10px] text-[var(--entity-shield)]/60'>
                  +{amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {deposits === undefined || claims === undefined ? (
        <p className='font-mono text-[10px] text-tx-dim text-center'>Loading...</p>
      ) : totalDeposited === 0 && (claims?.length ?? 0) === 0 ? (
        <p className='font-mono text-[10px] text-tx-dim text-center'>No activity yet.</p>
      ) : null}

    </div>
  )
}

export default PlayerProfile
