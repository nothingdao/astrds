import React, { useEffect, useState } from 'react'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { Rocket, Plus, ExternalLink, TrendingUp, TrendingDown, ChevronRight, ArrowLeft } from 'lucide-react'
import { useOverlayStore } from '@/stores/overlayStore'
import { Overlay } from '@/types/overlay'
import PlayerProfile from '@/components/common/PlayerProfile'

// ── Types ─────────────────────────────────────────────────────────────────────

type View =
  | { type: 'list' }
  | { type: 'token'; mint: string }
  | { type: 'depositor'; address: string }

type TokenMarketData = {
  price: number | null
  change24h: number | null
  volume24h: number | null
  liquidity: number | null
  dexUrl: string | null
}

type GroupedToken = {
  mintAddress: string
  symbol: string
  name: string
  logoUri?: string
  decimals: number
  totalRemaining: number
  totalDeposited: number
  deposits: any[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const short = (addr: string) => addr ? `${addr.slice(0, 4)}...${addr.slice(-4)}` : 'unknown'

const formatUsd = (n: number) => {
  if (n < 0.0001) return `$${n.toExponential(2)}`
  if (n < 1) return `$${n.toFixed(4)}`
  if (n < 1000) return `$${n.toFixed(2)}`
  return `$${(n / 1000).toFixed(1)}k`
}

const formatLarge = (n: number) => {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`
  return `$${n.toFixed(0)}`
}

async function fetchMarketData(mint: string): Promise<TokenMarketData> {
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`)
    const json = await res.json()
    const pairs: any[] = json.pairs ?? []
    if (pairs.length === 0) return { price: null, change24h: null, volume24h: null, liquidity: null, dexUrl: null }
    const best = pairs.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0]
    return {
      price: best.priceUsd ? parseFloat(best.priceUsd) : null,
      change24h: best.priceChange?.h24 ?? null,
      volume24h: best.volume?.h24 ?? null,
      liquidity: best.liquidity?.usd ?? null,
      dexUrl: best.url ?? null,
    }
  } catch {
    return { price: null, change24h: null, volume24h: null, liquidity: null, dexUrl: null }
  }
}

function groupDeposits(deposits: any[]): GroupedToken[] {
  const map = new Map<string, GroupedToken>()
  for (const d of deposits) {
    if (!map.has(d.mintAddress)) {
      map.set(d.mintAddress, {
        mintAddress: d.mintAddress,
        symbol: d.symbol,
        name: d.name,
        logoUri: d.logoUri,
        decimals: d.decimals ?? 0,
        totalRemaining: 0,
        totalDeposited: 0,
        deposits: [],
      })
    }
    const g = map.get(d.mintAddress)!
    g.totalRemaining += d.remainingAmount
    g.totalDeposited += d.totalAmount
    g.deposits.push(d)
  }
  return Array.from(map.values()).sort((a, b) => b.totalRemaining - a.totalRemaining)
}

// ── Sub-components ────────────────────────────────────────────────────────────

const Breadcrumb: React.FC<{ crumbs: { label: string; onClick: () => void }[] }> = ({ crumbs }) => (
  <div className='flex items-center gap-1.5 font-mono text-[10px] text-white/25 mb-4'>
    {crumbs.map((c, i) => (
      <React.Fragment key={c.label}>
        {i > 0 && <ChevronRight size={10} className='text-white/15' />}
        <button
          onClick={c.onClick}
          className={i === crumbs.length - 1 ? 'text-white/50' : 'hover:text-white/50 transition-colors'}
        >
          {c.label}
        </button>
      </React.Fragment>
    ))}
  </div>
)

const TokenRow: React.FC<{ group: GroupedToken; onClick: () => void }> = ({ group, onClick }) => {
  const [market, setMarket] = useState<TokenMarketData | null>(null)
  const remaining = group.totalRemaining / 10 ** group.decimals
  const total = group.totalDeposited / 10 ** group.decimals
  const pct = total > 0 ? remaining / total : 0
  const change = market?.change24h ?? null
  const isUp = change !== null && change >= 0

  useEffect(() => { fetchMarketData(group.mintAddress).then(setMarket) }, [group.mintAddress])

  return (
    <button
      onClick={onClick}
      className='w-full border border-white/8 rounded-lg p-4 hover:border-white/20 hover:bg-white/[0.02] transition-all text-left flex flex-col gap-3'
    >
      {/* Logo + symbol */}
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-2'>
          {group.logoUri
            ? <img src={group.logoUri} alt={group.symbol} className='w-7 h-7 rounded-full object-cover' />
            : <div className='w-7 h-7 rounded-full bg-purple-500/15 flex items-center justify-center'><span className='text-[8px] font-mono text-purple-400'>{group.symbol.slice(0, 2)}</span></div>
          }
          <div>
            <div className='font-mono text-xs text-white/80'>{group.symbol}</div>
            <div className='font-mono text-[9px] text-white/25 truncate max-w-[80px]'>{group.name}</div>
          </div>
        </div>
        <ChevronRight size={12} className='text-white/15' />
      </div>

      {/* Price */}
      <div>
        {market === null
          ? <div className='font-mono text-[10px] text-white/15 animate-pulse'>fetching...</div>
          : market.price === null
          ? <div className='font-mono text-[10px] text-white/15'>no price data</div>
          : <>
              <div className='font-mono text-sm text-white/70'>{formatUsd(market.price)}</div>
              {change !== null && (
                <div className={`flex items-center gap-0.5 font-mono text-[9px] mt-0.5 ${isUp ? 'text-green-400' : 'text-red-400'}`}>
                  {isUp ? <TrendingUp size={8} /> : <TrendingDown size={8} />}
                  {isUp ? '+' : ''}{change.toFixed(2)}%
                </div>
              )}
            </>
        }
      </div>

      {/* Depletion */}
      <div>
        <div className='flex items-center justify-between font-mono text-[8px] text-white/20 mb-1'>
          <span>{remaining.toLocaleString(undefined, { maximumFractionDigits: 0 })} left</span>
          <span>{group.deposits.length} pool{group.deposits.length !== 1 ? 's' : ''}</span>
        </div>
        <div className='w-full h-0.5 bg-white/5 rounded-full overflow-hidden'>
          <div
            className={`h-full transition-all ${pct > 0.5 ? 'bg-purple-400/50' : pct > 0.2 ? 'bg-yellow-400/50' : 'bg-red-400/50'}`}
            style={{ width: `${pct * 100}%` }}
          />
        </div>
      </div>
    </button>
  )
}

const TokenDetail: React.FC<{ group: GroupedToken; onDepositor: (addr: string) => void; onDeposit: () => void }> = ({ group, onDepositor, onDeposit }) => {
  const [market, setMarket] = useState<TokenMarketData | null>(null)
  const remaining = group.totalRemaining / 10 ** group.decimals
  const total = group.totalDeposited / 10 ** group.decimals
  const pct = total > 0 ? remaining / total : 0
  const change = market?.change24h ?? null
  const isUp = change !== null && change >= 0

  useEffect(() => { fetchMarketData(group.mintAddress).then(setMarket) }, [group.mintAddress])

  return (
    <div className='space-y-4'>

      {/* Hero */}
      <div className='border border-white/8 rounded-lg p-5'>
        <div className='flex items-start justify-between mb-4'>
          <div className='flex items-center gap-3'>
            {group.logoUri
              ? <img src={group.logoUri} alt={group.symbol} className='w-12 h-12 rounded-full object-cover' />
              : <div className='w-12 h-12 rounded-full bg-purple-500/15 flex items-center justify-center'><span className='text-xs font-mono text-purple-400'>{group.symbol.slice(0, 2)}</span></div>
            }
            <div>
              <div className='font-mono text-lg text-white/90'>{group.symbol}</div>
              <div className='font-mono text-[11px] text-white/35'>{group.name}</div>
            </div>
          </div>
          <div className='flex items-center gap-2'>
            {market?.dexUrl && (
              <a href={market.dexUrl} target='_blank' rel='noopener noreferrer'
                className='font-mono text-[9px] text-white/25 border border-white/8 px-2 py-1 hover:border-white/20 hover:text-white/50 transition-colors flex items-center gap-1'>
                DexScreener <ExternalLink size={9} />
              </a>
            )}
            <button onClick={onDeposit}
              className='font-mono text-[9px] text-game-blue/60 border border-game-blue/20 px-2 py-1 hover:border-game-blue/40 hover:text-game-blue transition-colors flex items-center gap-1'>
              <Plus size={9} /> Add Pool
            </button>
          </div>
        </div>

        {/* Price row */}
        {market && market.price !== null && (
          <div className='flex items-end gap-6 mb-4'>
            <div>
              <div className='font-mono text-2xl text-white/80'>{formatUsd(market.price)}</div>
              {change !== null && (
                <div className={`flex items-center gap-1 font-mono text-xs mt-0.5 ${isUp ? 'text-green-400' : 'text-red-400'}`}>
                  {isUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                  {isUp ? '+' : ''}{change.toFixed(2)}% 24h
                </div>
              )}
            </div>
            {market.volume24h !== null && (
              <div>
                <div className='font-mono text-[9px] text-white/20 uppercase tracking-widest'>24h Vol</div>
                <div className='font-mono text-sm text-white/50'>{formatLarge(market.volume24h)}</div>
              </div>
            )}
            {market.liquidity !== null && (
              <div>
                <div className='font-mono text-[9px] text-white/20 uppercase tracking-widest'>Liquidity</div>
                <div className='font-mono text-sm text-white/50'>{formatLarge(market.liquidity)}</div>
              </div>
            )}
          </div>
        )}

        {/* Pool totals */}
        <div className='flex items-center justify-between font-mono text-[10px] text-white/30 mb-1.5'>
          <span>{remaining.toLocaleString(undefined, { maximumFractionDigits: 2 })} of {total.toLocaleString(undefined, { maximumFractionDigits: 2 })} remaining</span>
          <span>{Math.round(pct * 100)}%</span>
        </div>
        <div className='w-full h-1 bg-white/5 rounded-full overflow-hidden'>
          <div
            className={`h-full transition-all ${pct > 0.5 ? 'bg-purple-400/60' : pct > 0.2 ? 'bg-yellow-400/60' : 'bg-red-400/60'}`}
            style={{ width: `${pct * 100}%` }}
          />
        </div>
      </div>

      {/* Depositor pools */}
      <div className='space-y-2'>
        <div className='font-mono text-[9px] text-white/25 uppercase tracking-widest'>Depositors</div>
        <div className='grid grid-cols-2 gap-2'>
          {group.deposits.map((d) => {
            const dr = d.remainingAmount / 10 ** group.decimals
            const dt = d.totalAmount / 10 ** group.decimals
            const dp = dt > 0 ? dr / dt : 0
            return (
              <button
                key={d._id}
                onClick={() => onDepositor(d.walletAddress)}
                className='border border-white/5 rounded-lg p-3 text-left hover:border-white/15 hover:bg-white/[0.02] transition-all flex flex-col gap-2'
              >
                <div className='font-mono text-[10px] text-game-blue/60 hover:text-game-blue transition-colors'>
                  {short(d.walletAddress)}
                </div>
                <div className='font-mono text-[9px] text-white/25'>
                  {dr.toLocaleString(undefined, { maximumFractionDigits: 0 })} left
                </div>
                <div className='font-mono text-[8px] text-white/20'>
                  L{d.minLevel}–{d.maxLevel} · {(d.tokensPerPill / 10 ** group.decimals).toLocaleString(undefined, { maximumFractionDigits: 2 })}/pill
                </div>
                <div className='w-full h-0.5 bg-white/5 rounded-full overflow-hidden'>
                  <div className='h-full bg-purple-400/40' style={{ width: `${dp * 100}%` }} />
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Main Screen ───────────────────────────────────────────────────────────────

const MiningScreen = ({ onClose }: { onClose: () => void }) => {
  const activeDeposits = useQuery(api.spaceDeposits.getAllActiveSpaceDeposits)
  const openOverlay = useOverlayStore((state) => state.openOverlay)
  const [view, setView] = useState<View>({ type: 'list' })

  const handleDeposit = () => { onClose(); openOverlay(Overlay.SPACE) }

  const groups = activeDeposits ? groupDeposits(activeDeposits) : []
  const currentGroup = view.type === 'token' ? groups.find((g) => g.mintAddress === view.mint) : null

  const crumbs = () => {
    const base = [{ label: 'Mining', onClick: () => setView({ type: 'list' }) }]
    if (view.type === 'token' && currentGroup) {
      base.push({ label: currentGroup.symbol, onClick: () => {} })
    }
    if (view.type === 'depositor') {
      if (history.length > 1) {
        // came from token — add token crumb back
      }
      base.push({ label: short(view.address), onClick: () => {} })
    }
    return base
  }

  return (
    <div className='p-5'>

      {/* Nav */}
      {view.type !== 'list' && (
        <div className='flex items-center gap-2 mb-4'>
          <button
            onClick={() => setView({ type: 'list' })}
            className='flex items-center gap-1 font-mono text-[10px] text-white/30 hover:text-white/60 transition-colors'
          >
            <ArrowLeft size={11} /> Mining
          </button>
          {view.type === 'token' && currentGroup && (
            <>
              <ChevronRight size={10} className='text-white/15' />
              <span className='font-mono text-[10px] text-white/50'>{currentGroup.symbol}</span>
            </>
          )}
          {view.type === 'depositor' && (
            <>
              <ChevronRight size={10} className='text-white/15' />
              <span className='font-mono text-[10px] text-white/50'>{short(view.address)}</span>
            </>
          )}
        </div>
      )}

      {/* List view */}
      {view.type === 'list' && (
        <div className='space-y-3'>
          <div className='flex items-center justify-between mb-1'>
            <p className='font-mono text-[10px] text-white/25'>
              Tokens floating in the asteroid field. Collect and claim on game over.
            </p>
            <button
              onClick={handleDeposit}
              className='flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-game-blue/60 border border-game-blue/20 px-3 py-1.5 hover:border-game-blue/50 hover:text-game-blue transition-colors shrink-0 ml-4'
            >
              <Plus size={11} /> Deposit
            </button>
          </div>

          {!activeDeposits ? (
            <div className='font-mono text-[10px] text-white/20 text-center py-12'>Loading...</div>
          ) : groups.length === 0 ? (
            <div className='border border-white/5 rounded-lg p-8 text-center space-y-3'>
              <Rocket size={24} className='text-white/10 mx-auto' />
              <p className='font-mono text-xs text-white/30'>No tokens in the asteroid field right now.</p>
              <button onClick={handleDeposit}
                className='font-mono text-[10px] uppercase tracking-widest text-game-blue/60 border border-game-blue/20 px-4 py-2 hover:border-game-blue/50 hover:text-game-blue transition-colors'>
                Launch Tokens into Space
              </button>
            </div>
          ) : (
            <div className='grid grid-cols-2 gap-3'>
              {groups.map((g) => (
                <TokenRow key={g.mintAddress} group={g} onClick={() => setView({ type: 'token', mint: g.mintAddress })} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Token detail view */}
      {view.type === 'token' && currentGroup && (
        <TokenDetail
          group={currentGroup}
          onDepositor={(addr) => setView({ type: 'depositor', address: addr })}
          onDeposit={handleDeposit}
        />
      )}

      {/* Depositor / public profile view */}
      {view.type === 'depositor' && (
        <PlayerProfile address={view.address} />
      )}

    </div>
  )
}

export default MiningScreen
