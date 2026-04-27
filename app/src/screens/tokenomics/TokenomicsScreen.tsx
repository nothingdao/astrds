import React, { useCallback, useState, useEffect } from 'react'
import { PublicKey } from '@solana/web3.js'
import { useMutation, useQuery } from 'convex/react'
import { useWallet } from '@solana/wallet-adapter-react'
import { api } from '../../../convex/_generated/api'
import { connection } from '@/lib/solana'
import {
  buildCrankLiquidityTransaction,
  buildMeteoraSwapTransaction,
  fetchLiquidityCrankState,
  fetchVaultConfig,
} from '@/lib/spaceVault'
import {
  ASTRDS_MINT,
  fetchMeteoraPoolSnapshot,
  getEmissionTier,
  METEORA_DAMM_POOL,
  TOTAL_ASTRDS_SUPPLY_CAP,
  TOTAL_GAMES_CAP,
  type EmissionTier,
  type MeteoraPoolSnapshot,
} from '@/lib/tokenomics'
import { Coins, BarChart3, ExternalLink } from 'lucide-react'
import { useArrowTabNav } from '@/hooks/useArrowTabNav'

const MINT = ASTRDS_MINT
const TREASURY = 'CNhWD1cXNaCMcjJmFcK25aFgV3ZTAFtyFDBvGfKZcpzF'
const VAULT_PROGRAM = '4bRZK8XfziVhLCgvtRdFJyTgN6tXGSPJT8xfbtt1AxBB'
const EXPLORER = (addr: string) => `https://orbmarkets.io/address/${addr}?cluster=devnet`
const TX_EXPLORER = (sig: string) => `https://orbmarkets.io/tx/${sig}?cluster=devnet`

type Tab = 'astrds' | 'economy'
const TOKENOMICS_TABS: Tab[] = ['astrds', 'economy']

// ── Shared primitives ─────────────────────────────────────────────────────────

const SectionLabel: React.FC<{ children: React.ReactNode; first?: boolean }> = ({ children, first }) => (
  <div className={`font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground ${first ? 'pt-3' : 'pt-5'} pb-1.5`}>
    {children}
  </div>
)

const StatRow: React.FC<{ label: string; value: React.ReactNode; sub?: string; link?: string }> = ({ label, value, sub, link }) => (
  <div className='flex items-start justify-between py-1.5 border-b border-border'>
    <span className='font-mono text-xs text-tx-secondary shrink-0 mr-4'>{label}</span>
    <div className='flex flex-col items-end'>
      <div className='flex items-center gap-1.5'>
        <span className='font-mono text-xs text-foreground text-right'>{value}</span>
        {link && (
          <a href={link} target='_blank' rel='noopener noreferrer'>
            <ExternalLink size={9} className='text-muted-foreground hover:text-tx-secondary transition-colors' />
          </a>
        )}
      </div>
      {sub && <span className='font-mono text-[10px] text-tx-tertiary text-right'>{sub}</span>}
    </div>
  </div>
)

const SupplyDonut: React.FC<{
  liquidity: number
  circulating: number
  unmined: number
}> = ({ liquidity, circulating, unmined }) => {
  const total = Math.max(liquidity + circulating + unmined, 1)
  const segments = [
    { label: 'Liquidity', value: liquidity, color: 'var(--primary)' },
    { label: 'Circulating', value: circulating, color: 'var(--text-success)' },
    { label: 'Unmined', value: unmined, color: 'var(--surface-medium)' },
  ]
  let cursor = 0
  const gradient = segments
    .map(segment => {
      const start = cursor
      const end = cursor + (segment.value / total) * 100
      cursor = end
      return `${segment.color} ${start}% ${end}%`
    })
    .join(', ')

  return (
    <div className='grid grid-cols-[88px_1fr] gap-4 items-center py-3 border-b border-border'>
      <div
        className='w-[88px] h-[88px] rounded-full relative border border-border shadow-[var(--shadow-accent-glow)]'
        style={{ background: `conic-gradient(${gradient})` }}
      >
        <div className='absolute inset-[18px] rounded-full bg-background border border-border flex items-center justify-center'>
          <span className='font-mono text-[9px] text-tx-tertiary uppercase tracking-widest'>ASTRDS</span>
        </div>
      </div>
      <div className='space-y-1.5'>
        {segments.map(segment => (
          <div key={segment.label} className='flex items-center justify-between gap-3'>
            <div className='flex items-center gap-2'>
              <span className='w-2 h-2 rounded-full' style={{ background: segment.color }} />
              <span className='font-mono text-[10px] uppercase tracking-wider text-tx-tertiary'>{segment.label}</span>
            </div>
            <span className='font-mono text-[10px] text-tx-secondary'>
              {segment.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

type EconomySnapshot = {
  timestamp: number
  source: 'manual' | 'crank' | 'cron'
  priceUsdPerAstrds: number
  solReserve: number
  astrdsReserve: number
  crankTxSignature?: string
}

const PriceSparkline: React.FC<{ snapshots: EconomySnapshot[] | undefined }> = ({ snapshots }) => {
  const points = snapshots ?? []

  if (points.length < 2) {
    return <StatRow label='Price Chart' value='collecting...' sub='shared snapshots appear after refreshes or cranks' />
  }

  const min = Math.min(...points.map(point => point.priceUsdPerAstrds))
  const max = Math.max(...points.map(point => point.priceUsdPerAstrds))
  const range = Math.max(max - min, max * 0.001, 0.000001)
  const d = points.map((point, index) => {
    const x = (index / (points.length - 1)) * 100
    const y = 40 - ((point.priceUsdPerAstrds - min) / range) * 34
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
  }).join(' ')

  return (
    <div className='py-2 border-b border-border'>
      <div className='flex items-center justify-between pb-1.5'>
        <span className='font-mono text-xs text-tx-secondary'>Price Chart</span>
        <span className='font-mono text-[10px] text-tx-tertiary'>shared Convex snapshots</span>
      </div>
      <svg viewBox='0 0 100 44' className='w-full h-20 overflow-visible'>
        <path d={d} fill='none' stroke='var(--primary)' strokeWidth='1.4' vectorEffect='non-scaling-stroke' />
        {points.map((point, index) => {
          if (point.source !== 'crank') return null
          const x = (index / (points.length - 1)) * 100
          const y = 40 - ((point.priceUsdPerAstrds - min) / range) * 34
          return <circle key={`${point.timestamp}-${index}`} cx={x} cy={y} r='1.8' fill='var(--text-success)' />
        })}
        <line x1='0' y1='40' x2='100' y2='40' stroke='var(--border-subtle)' strokeWidth='1' />
      </svg>
      <div className='flex justify-between font-mono text-[10px] text-tx-tertiary'>
        <span>low ${min.toFixed(4)}</span>
        <span>high ${max.toFixed(4)}</span>
      </div>
    </div>
  )
}

const parseUiAmount = (value: string, decimals: number): bigint => {
  const trimmed = value.trim()
  if (!trimmed || !/^\d*(\.\d*)?$/.test(trimmed)) return 0n
  const [wholeRaw, fracRaw = ''] = trimmed.split('.')
  const whole = wholeRaw || '0'
  const frac = fracRaw.padEnd(decimals, '0').slice(0, decimals)
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(frac || '0')
}

const IntegrationRow: React.FC<{ label: string; src?: string; value: string; sub?: string }> = ({ label, src, value, sub }) => (
  <div className='flex items-center justify-between py-2 border-b border-border'>
    <div className='flex items-center gap-2'>
      {src ? <img src={src} alt='' className='w-5 h-5 object-contain rounded-sm opacity-80' /> : <div className='w-5 h-5 rounded-sm border border-border' />}
      <span className='font-mono text-xs text-tx-secondary'>{label}</span>
    </div>
    <div className='flex flex-col items-end'>
      <span className='font-mono text-xs text-tx-primary'>{value}</span>
      {sub && <span className='font-mono text-[10px] text-tx-tertiary'>{sub}</span>}
    </div>
  </div>
)

const AddrRow: React.FC<{ label: string; addr: string }> = ({ label, addr }) => (
  <div className='flex items-center justify-between py-1.5 border-b border-border'>
    <span className='font-mono text-xs text-tx-secondary shrink-0 mr-4'>{label}</span>
    <a
      href={EXPLORER(addr)}
      target='_blank'
      rel='noopener noreferrer'
      className='flex items-center gap-1.5 font-mono text-[10px] text-primary/60 hover:text-primary transition-colors'
    >
      <span>{addr.slice(0, 4)}...{addr.slice(-4)}</span>
      <ExternalLink size={9} />
    </a>
  </div>
)

// ── $ASTRDS tab ───────────────────────────────────────────────────────────────

const AstrdsTab: React.FC = () => {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ totalSupply: 0, treasurySol: 0 })
  const [weights, setWeights] = useState({ op: 50, operator: 30, buyback: 20 })
  const totalGamesPlayed = useQuery(api.gameSessions.getTotalGamesPlayed)

  useEffect(() => {
    const load = async () => {
      try {
        const [supply, sol, config] = await Promise.all([
          connection.getTokenSupply(MINT),
          connection.getBalance(new PublicKey(TREASURY)),
          fetchVaultConfig(connection).catch(() => null),
        ])
        setStats({ totalSupply: supply.value.uiAmount || 0, treasurySol: sol / 1e9 })
        if (config) {
          setWeights({
            op:       config.paymentWeights.operationalBps / 100,
            operator: config.paymentWeights.operatorBps    / 100,
            buyback:  config.paymentWeights.buybackBps     / 100,
          })
        }
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <div>
      <SectionLabel first>Supply & Treasury</SectionLabel>
      <StatRow
        label='Total Supply'
        value={loading ? '...' : stats.totalSupply.toLocaleString()}
        sub={`/ ${TOTAL_ASTRDS_SUPPLY_CAP.toLocaleString()} cap`}
        link={EXPLORER(MINT.toString())}
      />
      <StatRow
        label='Games Played'
        value={totalGamesPlayed === undefined ? '...' : totalGamesPlayed.toLocaleString()}
        sub={`/ ${TOTAL_GAMES_CAP.toLocaleString()} emission slots`}
      />
      <StatRow
        label='Treasury'
        value={loading ? '...' : `${stats.treasurySol.toFixed(3)} SOL`}
        link={EXPLORER(TREASURY)}
      />

      <SectionLabel>Payment Split</SectionLabel>
      <StatRow label='Operational' value={loading ? '...' : `${weights.op}%`}       />
      <StatRow label='Operator'    value={loading ? '...' : `${weights.operator}%`} />
      <StatRow label='Buyback'     value={loading ? '...' : `${weights.buyback}%`}  />

      <SectionLabel>On-Chain</SectionLabel>
      <AddrRow label='$ASTRDS Mint'  addr={MINT.toString()} />
      <AddrRow label='Vault Program' addr={VAULT_PROGRAM}   />
      <AddrRow label='Treasury'      addr={TREASURY}        />

      <SectionLabel>How It Works</SectionLabel>
      {[
        'Pay ~$0.25 in SOL to insert a quarter and start a game',
        'Collect $ASTRDS pills floating in the asteroid field during gameplay',
        'At game over, collected pills are minted to your wallet at the current emission rate — determined by the live $ASTRDS price in the Meteora pool',
      ].map((step, i) => (
        <div key={i} className='flex gap-3 py-1.5 border-b border-border'>
          <span className='font-mono text-[10px] text-primary/60 shrink-0'>{String(i + 1).padStart(2, '0')}</span>
          <span className='font-mono text-xs text-tx-secondary'>{step}</span>
        </div>
      ))}

      <p className='font-mono text-[10px] text-tx-dim text-center uppercase tracking-widest pt-5 pb-3'>
        Devnet — not real money
      </p>
    </div>
  )
}

// ── Economy tab ───────────────────────────────────────────────────────────────

interface EconomyLiveData {
  pool: MeteoraPoolSnapshot
  tier: EmissionTier
  totalSupply: number
}

const useEconomyLiveData = () => {
  const [data, setData] = useState<EconomyLiveData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        setError(null)
        const [pool, supply] = await Promise.all([
          fetchMeteoraPoolSnapshot(),
          connection.getTokenSupply(MINT),
        ])
        setData({
          pool,
          tier: getEmissionTier(pool.priceUsdPerAstrds),
          totalSupply: supply.value.uiAmount ?? 0,
        })
      } catch {
        setError('Unable to read live pool state')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return { data, loading, error }
}

const EconomyTab: React.FC = () => {
  const { data, loading, error } = useEconomyLiveData()
  const totalGamesPlayed = useQuery(api.gameSessions.getTotalGamesPlayed)
  const economyStats = useQuery(api.spaceDeposits.getEconomyStats)
  const economySnapshots = useQuery(api.economySnapshots.latest, { limit: 96 }) as EconomySnapshot[] | undefined
  const recordEconomySnapshot = useMutation(api.economySnapshots.record)
  const wallet = useWallet()
  const [crankState, setCrankState] = useState<Awaited<ReturnType<typeof fetchLiquidityCrankState>> | null>(null)
  const [crankLoading, setCrankLoading] = useState(true)
  const [cranking, setCranking] = useState(false)
  const [crankError, setCrankError] = useState<string | null>(null)
  const [lastCrank, setLastCrank] = useState<{ signature: string; sol: number } | null>(null)
  const [buyAmount, setBuyAmount] = useState('')
  const [sellAmount, setSellAmount] = useState('')
  const [swapping, setSwapping] = useState<'buy' | 'sell' | null>(null)
  const [swapError, setSwapError] = useState<string | null>(null)
  const [lastSwap, setLastSwap] = useState<{ signature: string; direction: 'buy' | 'sell'; amount: string } | null>(null)
  const poolAddr = data?.pool.poolAddress ?? METEORA_DAMM_POOL.toBase58()
  const liquidityAstrds = data?.pool.astrdsReserve ?? 0
  const circulatingAstrds = data ? Math.max(0, data.totalSupply - liquidityAstrds) : 0
  const unminedAstrds = data ? Math.max(0, TOTAL_ASTRDS_SUPPLY_CAP - data.totalSupply) : 0

  const loadCrankState = useCallback(async () => {
    try {
      setCrankLoading(true)
      setCrankError(null)
      setCrankState(await fetchLiquidityCrankState(connection))
    } catch (err) {
      setCrankError(err instanceof Error ? err.message : 'Unable to read crank state')
    } finally {
      setCrankLoading(false)
    }
  }, [])

  useEffect(() => {
    loadCrankState()
  }, [loadCrankState])

  const recordSnapshot = useCallback(async (source: 'manual' | 'crank', crankTxSignature?: string) => {
    const [snapshot, state] = await Promise.all([
      fetchMeteoraPoolSnapshot(),
      fetchLiquidityCrankState(connection),
    ])
    const supply = await connection.getTokenSupply(MINT)
    await recordEconomySnapshot({
      source,
      poolAddress: snapshot.poolAddress,
      solUsdPrice: snapshot.solUsdPrice,
      astrdsReserve: snapshot.astrdsReserve,
      solReserve: snapshot.solReserve,
      priceSolPerAstrds: snapshot.priceSolPerAstrds,
      priceUsdPerAstrds: snapshot.priceUsdPerAstrds,
      totalSupply: supply.value.uiAmount ?? 0,
      pendingBuybackSol: state.pendingSol,
      crankTxSignature,
    })
  }, [recordEconomySnapshot])

  useEffect(() => {
    if (!data || !crankState) return
    recordEconomySnapshot({
      source: 'manual',
      poolAddress: data.pool.poolAddress,
      solUsdPrice: data.pool.solUsdPrice,
      astrdsReserve: data.pool.astrdsReserve,
      solReserve: data.pool.solReserve,
      priceSolPerAstrds: data.pool.priceSolPerAstrds,
      priceUsdPerAstrds: data.pool.priceUsdPerAstrds,
      totalSupply: data.totalSupply,
      pendingBuybackSol: crankState.pendingSol,
    }).catch(() => {})
  }, [crankState, data, recordEconomySnapshot])

  const handleSwap = useCallback(async (direction: 'buy' | 'sell') => {
    if (!wallet.publicKey || !wallet.sendTransaction) return

    try {
      setSwapping(direction)
      setSwapError(null)
      const amount = direction === 'buy' ? buyAmount : sellAmount
      const uiAmount = Number(amount)
      if (!Number.isFinite(uiAmount) || uiAmount <= 0) throw new Error('Enter an amount greater than 0')
      if (direction === 'buy' && data && uiAmount > data.pool.solReserve * 0.25) {
        throw new Error(`Devnet pool is shallow. Try buying <= ${(data.pool.solReserve * 0.25).toFixed(6)} SOL.`)
      }
      if (direction === 'sell' && data && uiAmount > data.pool.astrdsReserve * 0.25) {
        throw new Error(`Devnet pool is shallow. Try selling <= ${(data.pool.astrdsReserve * 0.25).toFixed(4)} ASTRDS.`)
      }
      const rawAmountIn = parseUiAmount(amount, 9)

      const built = await buildMeteoraSwapTransaction({
        connection,
        user: wallet.publicKey,
        direction,
        rawAmountIn,
        minimumAmountOut: 0,
      })
      const signature = await wallet.sendTransaction(built.transaction, connection, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      })
      await connection.confirmTransaction(
        {
          signature,
          blockhash: built.blockhash,
          lastValidBlockHeight: built.lastValidBlockHeight,
        },
        'confirmed'
      )
      setLastSwap({ signature, direction, amount })
      await recordSnapshot('manual')
    } catch (err) {
      setSwapError(err instanceof Error ? err.message : 'Swap failed')
    } finally {
      setSwapping(null)
    }
  }, [buyAmount, data, recordSnapshot, sellAmount, wallet.publicKey, wallet.sendTransaction])

  const handleCrank = useCallback(async () => {
    if (!wallet.publicKey || !wallet.sendTransaction || !crankState || crankState.pendingLamports <= 0) return

    try {
      setCranking(true)
      setCrankError(null)
      const built = await buildCrankLiquidityTransaction({
        connection,
        cranker: wallet.publicKey,
        lamports: crankState.pendingLamports,
      })
      const signature = await wallet.sendTransaction(built.transaction, connection, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      })
      await connection.confirmTransaction(
        {
          signature,
          blockhash: built.blockhash,
          lastValidBlockHeight: built.lastValidBlockHeight,
        },
        'confirmed'
      )
      setLastCrank({ signature, sol: crankState.pendingSol })
      await loadCrankState()
      await recordSnapshot('crank', signature)
    } catch (err) {
      setCrankError(err instanceof Error ? err.message : 'Liquidity crank failed')
    } finally {
      setCranking(false)
    }
  }, [crankState, loadCrankState, recordSnapshot, wallet.publicKey, wallet.sendTransaction])

  return (
    <div>
      {error && (
        <div className='font-mono text-xs text-destructive/80 border border-destructive/15 bg-destructive/10 px-3 py-2 mt-3'>
          {error}
        </div>
      )}

      <SectionLabel first>Live Economy</SectionLabel>
      <StatRow
        label='Price (Derived)'
        value={loading || !data ? '...' : `$${data.pool.priceUsdPerAstrds.toFixed(4)}`}
        sub={!loading && data ? `${data.pool.priceSolPerAstrds.toFixed(8)} SOL` : undefined}
      />
      <StatRow
        label='Emission Tier'
        value={loading || !data ? '...' : `${data.tier.tier} of 5`}
        sub={!loading && data ? `${data.tier.pillsPerGame} pills · ${data.tier.astrdsPerPill} ASTRDS each` : undefined}
      />
      <StatRow
        label='Pool SOL Depth'
        value={loading || !data ? '...' : `${data.pool.solReserve.toFixed(4)} SOL`}
        sub={!loading && data ? `${data.pool.astrdsReserve.toLocaleString(undefined, { maximumFractionDigits: 0 })} ASTRDS paired` : undefined}
      />
      <StatRow
        label='Minted Supply'
        value={loading || !data ? '...' : data.totalSupply.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        sub={`/ ${TOTAL_ASTRDS_SUPPLY_CAP.toLocaleString()} cap`}
      />
      <StatRow
        label='Games Played'
        value={totalGamesPlayed === undefined ? '...' : totalGamesPlayed.toLocaleString()}
        sub={totalGamesPlayed !== undefined ? `${((totalGamesPlayed / TOTAL_GAMES_CAP) * 100).toFixed(2)}% of schedule` : undefined}
      />
      <StatRow
        label='Active Token Pools'
        value={economyStats === undefined ? '...' : economyStats.activePools.toLocaleString()}
        sub={economyStats !== undefined ? `${economyStats.uniqueMints} token${economyStats.uniqueMints !== 1 ? 's' : ''} · ${economyStats.totalClaims} claims` : undefined}
      />
      <StatRow
        label='Unique Claimers'
        value={economyStats === undefined ? '...' : economyStats.uniqueClaimers.toLocaleString()}
      />
      <StatRow label='Emission Model' value='Server' sub='authoritative · enforced on-chain' />

      <SectionLabel>ASTRDS Supply Map</SectionLabel>
      {loading || !data ? (
        <StatRow label='Supply Map' value='...' />
      ) : (
        <SupplyDonut
          liquidity={liquidityAstrds}
          circulating={circulatingAstrds}
          unmined={unminedAstrds}
        />
      )}
      <PriceSparkline snapshots={economySnapshots} />

      <SectionLabel>Integrations</SectionLabel>
      <IntegrationRow label='Meteora' src='/assets/meteoraProgram.webp' value='DAMM v2' sub='ASTRDS / SOL liquidity' />
      <IntegrationRow label='Helius' src='/assets/poweredByHelius.svg' value='RPC / webhooks' sub='configured provider' />
      <IntegrationRow label='SOL/USD' value='Coinbase → Binance → CoinGecko' sub='server-side Convex action' />

      <SectionLabel>Market Swap</SectionLabel>
      <div className='border border-border bg-surface-subtle px-3 py-3 space-y-2'>
        <div className='grid grid-cols-[1fr_auto_auto] gap-2 items-center'>
          <input
            value={buyAmount}
            onChange={(e) => setBuyAmount(e.target.value)}
            placeholder='0.0001'
            className='min-w-0 bg-surface-overlay border border-border px-3 py-2 font-mono text-xs text-foreground placeholder:text-tx-dim outline-none focus:border-primary/50'
          />
          <span className='font-mono text-[10px] text-muted-foreground uppercase tracking-wider w-12'>SOL</span>
          <button
            onClick={() => handleSwap('buy')}
            disabled={!wallet.publicKey || !!swapping}
            className='font-mono text-[10px] uppercase tracking-widest border border-primary/40 bg-primary/15 text-primary hover:bg-primary/25 disabled:opacity-40 px-3 py-2 transition-colors whitespace-nowrap'
          >
            {swapping === 'buy' ? 'Buying...' : 'Buy ASTRDS'}
          </button>
        </div>
        <div className='grid grid-cols-[1fr_auto_auto] gap-2 items-center'>
          <input
            value={sellAmount}
            onChange={(e) => setSellAmount(e.target.value)}
            placeholder='0.1'
            className='min-w-0 bg-surface-overlay border border-border px-3 py-2 font-mono text-xs text-foreground placeholder:text-tx-dim outline-none focus:border-destructive/40'
          />
          <span className='font-mono text-[10px] text-muted-foreground uppercase tracking-wider w-12'>ASTRDS</span>
          <button
            onClick={() => handleSwap('sell')}
            disabled={!wallet.publicKey || !!swapping}
            className='font-mono text-[10px] uppercase tracking-widest border border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20 disabled:opacity-40 px-3 py-2 transition-colors whitespace-nowrap'
          >
            {swapping === 'sell' ? 'Selling...' : 'Sell ASTRDS'}
          </button>
        </div>
        <p className='font-mono text-[10px] text-tx-tertiary leading-relaxed'>
          Swaps route through the configured Meteora devnet pool and record a shared economy snapshot after confirmation.
        </p>
        {lastSwap && (
          <a href={TX_EXPLORER(lastSwap.signature)} target='_blank' rel='noopener noreferrer' className='block font-mono text-[10px] text-primary/70 hover:text-primary'>
            Last {lastSwap.direction}: {lastSwap.amount} · {lastSwap.signature.slice(0, 8)}...{lastSwap.signature.slice(-8)}
          </a>
        )}
        {swapError && (
          <div className='font-mono text-xs text-destructive/80 border border-destructive/15 bg-destructive/10 px-3 py-2'>
            {swapError}
          </div>
        )}
      </div>

      <SectionLabel>Liquidity Crank</SectionLabel>
      <StatRow
        label='Pending Buyback SOL'
        value={crankLoading || !crankState ? '...' : `${crankState.pendingSol.toFixed(6)} SOL`}
        sub='20% of every insert-quarter accrues here until cranked'
      />
      <StatRow
        label='Crank Status'
        value={cranking ? 'running...' : crankState?.positionExists ? 'position active' : 'position not created'}
        sub='automated handoff: accrued SOL → swap half → add liquidity → lock position'
      />
      {lastCrank && (
        <StatRow
          label='Last Crank'
          value={`${lastCrank.sol.toFixed(6)} SOL`}
          sub={lastCrank.signature.slice(0, 8) + '...' + lastCrank.signature.slice(-8)}
          link={TX_EXPLORER(lastCrank.signature)}
        />
      )}
      {crankError && (
        <div className='font-mono text-xs text-destructive/80 border border-destructive/15 bg-destructive/10 px-3 py-2 mt-2'>
          {crankError}
        </div>
      )}
      <div className='grid grid-cols-2 gap-2 pt-2'>
        <button
          onClick={loadCrankState}
          disabled={crankLoading || cranking}
          className='font-mono text-[10px] uppercase tracking-widest border border-edge-subtle text-tx-secondary hover:text-foreground hover:border-edge-medium disabled:opacity-40 px-3 py-2 transition-colors'
        >
          Refresh Crank
        </button>
        <button
          onClick={handleCrank}
          disabled={!wallet.publicKey || !crankState || crankState.pendingLamports <= 0 || cranking}
          className='font-mono text-[10px] uppercase tracking-widest border border-primary/40 bg-primary/15 text-primary hover:bg-primary/25 disabled:opacity-40 disabled:hover:bg-primary/15 px-3 py-2 transition-colors'
        >
          {cranking ? 'Cranking...' : 'Crank Liquidity'}
        </button>
      </div>
      <p className='font-mono text-[10px] text-tx-tertiary pt-2 leading-relaxed'>
        Insert Quarter no longer depends on Meteora. It only collects payment and queues the buyback share.
        The crank is the automated keeper handoff that can run repeatedly until the full game schedule is exhausted.
      </p>

      <SectionLabel>Emission Logic</SectionLabel>
      <StatRow label='Price source'       value='Meteora DAMM v2 reserve ratio' />
      <StatRow
        label='Rate enforcement'
        value='Session start snapshot'
        sub='pill cap enforced for session duration'
      />
      <StatRow
        label='SOL/USD'
        value={loading || !data ? '...' : `$${data.pool.solUsdPrice.toFixed(2)}`}
        sub='Jupiter · 60s cache'
      />
      <AddrRow label='Pool address' addr={poolAddr} />

      <p className='font-mono text-[10px] text-tx-dim text-center uppercase tracking-widest pt-5 pb-3'>
        Devnet — not real money
      </p>
    </div>
  )
}

// ── Root with tab nav ─────────────────────────────────────────────────────────

const TokenomicsScreen: React.FC<{ onClose: () => void }> = () => {
  const [tab, setTab] = useState<Tab>('astrds')
  const setTabCb = useCallback((t: Tab) => setTab(t), [])
  useArrowTabNav(TOKENOMICS_TABS, tab, setTabCb)

  return (
    <div className='flex flex-col h-full'>
      <div className='flex border-b border-border px-5 shrink-0'>
        {([
          { id: 'astrds',  icon: Coins,    label: '$ASTRDS' },
          { id: 'economy', icon: BarChart3, label: 'Economy' },
        ] as { id: Tab; icon: React.ElementType; label: string }[]).map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 font-mono text-[10px] uppercase tracking-wider transition-colors border-b-2 -mb-px ${
              tab === id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-tx-secondary'
            }`}
          >
            <Icon size={10} />
            {label}
          </button>
        ))}
      </div>

      <div className='flex-1 overflow-y-auto min-h-0 px-5'>
        {tab === 'astrds' ? <AstrdsTab /> : <EconomyTab />}
      </div>
    </div>
  )
}

export default TokenomicsScreen
