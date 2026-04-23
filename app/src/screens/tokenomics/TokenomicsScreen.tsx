import React, { useState, useEffect } from 'react'
import { PublicKey } from '@solana/web3.js'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { connection } from '@/lib/solana'
import { fetchVaultConfig } from '@/lib/spaceVault'
import {
  ASTRDS_MINT,
  BURNED_ASTRDS_STUB,
  fetchMeteoraPoolSnapshot,
  getEmissionTier,
  METEORA_DAMM_POOL,
  TOTAL_ASTRDS_SUPPLY_CAP,
  TOTAL_GAMES_CAP,
  type EmissionTier,
  type MeteoraPoolSnapshot,
} from '@/lib/tokenomics'
import {
  Coins,
  Wallet,
  ExternalLink,
  Shield,
  Zap,
  ArrowRightLeft,
  BarChart3,
  Flame,
  Pill,
  Waves,
  Joystick,
} from 'lucide-react'

const MINT = ASTRDS_MINT
const TREASURY = new PublicKey('CNhWD1cXNaCMcjJmFcK25aFgV3ZTAFtyFDBvGfKZcpzF')
const EXPLORER = (addr: string) => `https://orbmarkets.io/address/${addr}?cluster=devnet`

type Tab = 'astrds' | 'economy'

// ── $ASTRDS tab ───────────────────────────────────────────────────────────────

const AstrdsTab: React.FC = () => {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ totalSupply: 0, holders: 0, treasurySol: 0 })
  const [weights, setWeights] = useState({ op: 50, operator: 30, buyback: 20 })

  useEffect(() => {
    const fetch = async () => {
      try {
        const [supply, accounts, sol, config] = await Promise.all([
          connection.getTokenSupply(MINT),
          connection.getTokenLargestAccounts(MINT),
          connection.getBalance(TREASURY),
          fetchVaultConfig(connection).catch(() => null),
        ])
        setStats({
          totalSupply: supply.value.uiAmount || 0,
          holders: accounts.value.length,
          treasurySol: sol / 1e9,
        })
        if (config) {
          setWeights({
            op: config.paymentWeights.operationalBps / 100,
            operator: config.paymentWeights.operatorBps / 100,
            buyback: config.paymentWeights.buybackBps / 100,
          })
        }
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [])

  return (
    <div className='space-y-5'>
      <div className='grid grid-cols-3 gap-3'>
        {[
          { icon: Coins, label: 'Total Supply', value: loading ? '...' : stats.totalSupply.toLocaleString(), sub: '$ASTRDS minted', link: EXPLORER(MINT.toString()) },
          { icon: Wallet, label: 'Holders', value: loading ? '...' : stats.holders.toLocaleString(), sub: 'unique wallets', link: null },
          { icon: ArrowRightLeft, label: 'Treasury', value: loading ? '...' : `${stats.treasurySol.toFixed(3)} SOL`, sub: 'vault balance', link: EXPLORER(TREASURY.toString()) },
        ].map(({ icon: Icon, label, value, sub, link }) => (
          <div key={label} className='bg-neutral-800 border border-white/10 rounded-lg p-4'>
            <div className='flex items-center justify-between mb-3'>
              <Icon size={14} className='text-game-blue/60' />
              {link && (
                <a href={link} target='_blank' rel='noopener noreferrer' className='text-white/20 hover:text-white/60 transition-colors'>
                  <ExternalLink size={12} />
                </a>
              )}
            </div>
            <div className='font-mono text-lg text-white'>{value}</div>
            <div className='font-mono text-[10px] text-white/30 uppercase tracking-widest mt-1'>{label}</div>
            <div className='font-mono text-[9px] text-white/20 mt-0.5'>{sub}</div>
          </div>
        ))}
      </div>

      <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
        <div className='bg-neutral-800 border border-white/10 rounded-lg p-5 space-y-4'>
          <h3 className='font-mono text-xs text-game-blue uppercase tracking-widest flex items-center gap-2'>
            <Zap size={13} /> How $ASTRDS Works
          </h3>
          <div className='space-y-3 font-mono text-xs text-white/50'>
            <div className='flex gap-3'><span className='text-game-blue/60 shrink-0'>01</span><span>Pay ~$0.25 in SOL to insert a quarter and start a game</span></div>
            <div className='flex gap-3'><span className='text-game-blue/60 shrink-0'>02</span><span>Collect $ASTRDS tokens floating in the asteroid field during gameplay</span></div>
            <div className='flex gap-3'><span className='text-game-blue/60 shrink-0'>03</span><span>On game over, collected tokens are minted to your wallet — 1 collected = 1 $ASTRDS. No pre-mine. No team allocation. 100% earned through play.</span></div>
          </div>
        </div>

        <div className='bg-neutral-800 border border-white/10 rounded-lg p-5 space-y-4'>
          <h3 className='font-mono text-xs text-game-blue uppercase tracking-widest flex items-center gap-2'>
            <ArrowRightLeft size={13} /> Quarter Payment Split
          </h3>
          <div className='space-y-2'>
            {[
              { label: 'Operational', pct: weights.op, color: 'bg-game-blue' },
              { label: 'Operator', pct: weights.operator, color: 'bg-purple-400' },
              { label: 'Buyback', pct: weights.buyback, color: 'bg-green-400' },
            ].map(({ label, pct, color }) => (
              <div key={label} className='flex items-center gap-3'>
                <div className={`w-1.5 h-1.5 rounded-full ${color} shrink-0`} />
                <div className='flex-1'>
                  <div className='font-mono text-xs text-white/60'>{label}</div>
                </div>
                <div className='font-mono text-xs text-white/40'>{loading ? '...' : `${pct}%`}</div>
              </div>
            ))}
          </div>
          <p className='font-mono text-[10px] text-white/20 border-t border-white/5 pt-3'>
            Weights are admin-adjustable on-chain via the vault program.
          </p>
        </div>

        <div className='bg-neutral-800 border border-white/10 rounded-lg p-5 space-y-4'>
          <h3 className='font-mono text-xs text-game-blue uppercase tracking-widest flex items-center gap-2'>
            <Shield size={13} /> On-Chain Vault
          </h3>
          <p className='font-mono text-xs text-white/50'>Your tokens never pass through our hands. Every deposit, claim, and payment settles directly on Solana — verifiable by anyone.</p>
          <div className='space-y-1.5 font-mono text-[10px]'>
            <div>
              <div className='text-white/25 mb-0.5'>$ASTRDS Mint</div>
              <a href={EXPLORER(MINT.toString())} target='_blank' rel='noopener noreferrer' className='text-game-blue/60 hover:text-game-blue transition-colors break-all'>{MINT.toString()}</a>
            </div>
            <div>
              <div className='text-white/25 mb-0.5'>Vault Program</div>
              <a href={EXPLORER('4bRZK8XfziVhLCgvtRdFJyTgN6tXGSPJT8xfbtt1AxBB')} target='_blank' rel='noopener noreferrer' className='text-game-blue/60 hover:text-game-blue transition-colors break-all'>4bRZK8XfziVhLCgvtRdFJyTgN6tXGSPJT8xfbtt1AxBB</a>
            </div>
          </div>
        </div>
      </div>

      <p className='font-mono text-[9px] text-white/10 text-center uppercase tracking-widest'>Devnet — not real money</p>
    </div>
  )
}

// ── Economy tab ───────────────────────────────────────────────────────────────

interface EconomyLiveData {
  pool: MeteoraPoolSnapshot
  tier: EmissionTier
  circulatingSupply: number
  totalBurned: number
}

const useEconomyLiveData = (): {
  data: EconomyLiveData | null
  loading: boolean
  error: string | null
} => {
  const [data, setData] = useState<EconomyLiveData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetch = async () => {
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
          circulatingSupply: supply.value.uiAmount ?? 0,
          totalBurned: BURNED_ASTRDS_STUB,
        })
      } catch {
        setError('Unable to read live pool state')
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [])

  return { data, loading, error }
}

const EconomyTab: React.FC = () => {
  const { data, loading, error } = useEconomyLiveData()
  const totalGamesPlayed = useQuery(api.gameSessions.getTotalGamesPlayed)

  const economyCards = [
    {
      icon: Coins,
      label: 'Derived Price',
      value: loading || !data ? '...' : `$${data.pool.priceUsdPerAstrds.toFixed(4)}`,
      sub: loading || !data ? 'reading Meteora DAMM v2' : `${data.pool.priceSolPerAstrds.toFixed(8)} SOL per ASTRDS`,
    },
    {
      icon: Pill,
      label: 'Emission Tier',
      value: loading || !data ? '...' : `${data.tier.tier} of 5`,
      sub: loading || !data ? 'loading bands' : `${data.tier.pillsPerGame} pills / ${data.tier.astrdsPerPill} ASTRDS`,
    },
    {
      icon: Waves,
      label: 'Pool SOL Depth',
      value: loading || !data ? '...' : `${data.pool.solReserve.toFixed(6)} SOL`,
      sub: loading || !data ? 'reading reserve vaults' : `${data.pool.astrdsReserve.toLocaleString(undefined, { maximumFractionDigits: 2 })} ASTRDS paired`,
    },
    {
      icon: Joystick,
      label: 'Games Played',
      value: totalGamesPlayed === undefined ? '...' : totalGamesPlayed.toLocaleString(),
      sub: `${TOTAL_GAMES_CAP.toLocaleString()} total emission slots`,
    },
    {
      icon: Coins,
      label: 'Circulating Supply',
      value: loading || !data ? '...' : data.circulatingSupply.toLocaleString(undefined, { maximumFractionDigits: 0 }),
      sub: `${TOTAL_ASTRDS_SUPPLY_CAP.toLocaleString()} hard cap`,
    },
    {
      icon: Flame,
      label: 'Total Burned',
      value: loading || !data ? '...' : data.totalBurned.toLocaleString(),
      sub: 'stubbed to 0 until burn tracking lands',
    },
  ]

  return (
    <div className='space-y-5'>
      <div>
        <div className='font-mono text-[10px] text-white/25 uppercase tracking-widest mb-3'>Live Economy</div>
        <div className='grid grid-cols-2 md:grid-cols-3 gap-3'>
          {economyCards.map(({ icon: Icon, label, value, sub }) => (
            <div key={label} className='bg-neutral-800 border border-white/10 rounded-lg p-4'>
              <div className='flex items-center justify-between mb-3'>
                <Icon size={14} className='text-game-blue/60' />
              </div>
              <div className='font-mono text-lg text-white'>{value}</div>
              <div className='font-mono text-[10px] text-white/30 uppercase tracking-widest mt-1'>{label}</div>
              <div className='font-mono text-[9px] text-white/20 mt-0.5'>{sub}</div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className='font-mono text-[10px] text-white/25 uppercase tracking-widest mb-3'>Emission Logic</div>
        <div className='bg-neutral-800 border border-white/10 rounded-lg p-5 space-y-4'>
          <div className='flex items-start justify-between gap-4'>
            <div>
              <div className='font-mono text-xs text-white/70'>Current game payout band</div>
              <div className='font-mono text-[10px] text-white/25 mt-1'>
                {loading || !data
                  ? 'Reading price band from the live devnet pool.'
                  : `Tier ${data.tier.tier}: ${data.tier.pillsPerGame} pills per game at ${data.tier.astrdsPerPill} ASTRDS per pill.`}
              </div>
            </div>
            {data && (
              <a
                href={EXPLORER(data.pool.poolAddress)}
                target='_blank'
                rel='noopener noreferrer'
                className='text-white/20 hover:text-white/60 transition-colors shrink-0'
              >
                <ExternalLink size={12} />
              </a>
            )}
          </div>

          <div className='grid grid-cols-2 gap-3'>
            <div className='border border-white/5 rounded-lg p-3'>
              <div className='font-mono text-[9px] text-white/20 uppercase tracking-widest'>Pool Address</div>
              <div className='font-mono text-[10px] text-game-blue/60 break-all mt-1'>
                {data?.pool.poolAddress ?? METEORA_DAMM_POOL.toBase58()}
              </div>
            </div>
            <div className='border border-white/5 rounded-lg p-3'>
              <div className='font-mono text-[9px] text-white/20 uppercase tracking-widest'>Progress</div>
              <div className='font-mono text-[10px] text-white/60 mt-1'>
                {totalGamesPlayed === undefined
                  ? '...'
                  : `${((totalGamesPlayed / TOTAL_GAMES_CAP) * 100).toFixed(2)}% of the 420,000-game schedule`}
              </div>
            </div>
          </div>

          {[
            { label: 'Pool Pair', value: 'ASTRDS / SOL (devnet)' },
            {
              label: 'Price Source',
              value: loading || !data
                ? 'Reading Meteora vault balances'
                : `${data.pool.astrdsReserve.toLocaleString(undefined, { maximumFractionDigits: 2 })} ASTRDS vs ${data.pool.solReserve.toFixed(6)} SOL`,
            },
            {
              label: 'Tier Basis',
              value: loading || !data
                ? 'Waiting for SOL/USD conversion'
                : `$${data.pool.priceUsdPerAstrds.toFixed(4)} using SOL/USD ${data.pool.solUsdPrice.toFixed(2)}`,
            },
          ].map(({ label, value }) => (
            <div key={label} className='flex items-start justify-between gap-4'>
              <span className='font-mono text-[10px] text-white/30 shrink-0'>{label}</span>
              <span className='font-mono text-[10px] text-white/55 break-all text-right'>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className='font-mono text-[10px] text-red-300/70 border border-red-400/10 bg-red-950/20 rounded-lg p-3'>
          {error}
        </div>
      )}

      <p className='font-mono text-[9px] text-white/10 text-center uppercase tracking-widest'>Devnet — not real money</p>
    </div>
  )
}

// ── Root with tab nav ─────────────────────────────────────────────────────────

const TokenomicsScreen: React.FC<{ onClose: () => void }> = () => {
  const [tab, setTab] = useState<Tab>('astrds')

  return (
    <div className='p-5 space-y-5'>
      <div className='flex gap-1 border-b border-white/10 pb-0'>
        {([
          { id: 'astrds', icon: Coins, label: '$ASTRDS' },
          { id: 'economy', icon: BarChart3, label: 'Economy' },
        ] as { id: Tab; icon: React.ElementType; label: string }[]).map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2 font-mono text-xs uppercase tracking-wider transition-colors border-b-2 -mb-px ${
              tab === id
                ? 'border-game-blue text-white'
                : 'border-transparent text-white/30 hover:text-white/60'
            }`}
          >
            <Icon size={12} />
            {label}
          </button>
        ))}
      </div>

      {tab === 'astrds' ? <AstrdsTab /> : <EconomyTab />}
    </div>
  )
}

export default TokenomicsScreen
