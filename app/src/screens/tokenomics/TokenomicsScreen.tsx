import React, { useState, useEffect } from 'react'
import { PublicKey } from '@solana/web3.js'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { connection } from '@/lib/solana'
import { getAssociatedTokenAddressSync } from '@solana/spl-token'
import { fetchVaultConfig } from '@/lib/spaceVault'
import {
  Coins,
  Wallet,
  ExternalLink,
  Shield,
  Zap,
  ArrowRightLeft,
  BarChart3,
} from 'lucide-react'

const MINT = new PublicKey('5sqKSHDKZr4KbNzj972PSfmEhtR9eLeBvv1nBRbeQAnB')
const TREASURY = new PublicKey('CNhWD1cXNaCMcjJmFcK25aFgV3ZTAFtyFDBvGfKZcpzF')
const DEPLOYER = new PublicKey('jrXCZwP8bxDnGs7ChD4F77We1K4J89R53SAVk5HsSoE')
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

interface WalletBalance {
  sol: number | null
  astrds: number | null
}

const useWalletBalance = (pubkey: PublicKey, fetchAstrds = false): WalletBalance => {
  const [bal, setBal] = useState<WalletBalance>({ sol: null, astrds: null })
  useEffect(() => {
    const fetch = async () => {
      try {
        const sol = await connection.getBalance(pubkey)
        let astrds: number | null = null
        if (fetchAstrds) {
          try {
            const ata = getAssociatedTokenAddressSync(MINT, pubkey)
            const info = await connection.getTokenAccountBalance(ata)
            astrds = info.value.uiAmount
          } catch {
            astrds = 0
          }
        }
        setBal({ sol: sol / 1e9, astrds })
      } catch {
        setBal({ sol: null, astrds: null })
      }
    }
    fetch()
  }, [pubkey, fetchAstrds])
  return bal
}

const Bal: React.FC<{ val: number | null; suffix?: string; decimals?: number }> = ({ val, suffix = '', decimals = 3 }) =>
  val === null
    ? <span className='text-white/20'>...</span>
    : <span className='text-white'>{val.toLocaleString(undefined, { maximumFractionDigits: decimals })}{suffix && <span className='text-white/30 ml-1 text-[10px]'>{suffix}</span>}</span>

const EconomyTab: React.FC = () => {
  const stats = useQuery(api.spaceDeposits.getEconomyStats)
  const treasury = useWalletBalance(TREASURY, true)
  const deployer = useWalletBalance(DEPLOYER)

  const statCards = [
    { label: 'Active Pools', value: stats?.activePools ?? null, sub: 'depositors' },
    { label: 'Unique Mints', value: stats?.uniqueMints ?? null, sub: 'tokens in space' },
    { label: 'Total Claims', value: stats?.totalClaims ?? null, sub: 'all time' },
    { label: 'Claimers', value: stats?.uniqueClaimers ?? null, sub: 'unique wallets' },
  ]

  return (
    <div className='space-y-5'>

      {/* Game stats */}
      <div>
        <div className='font-mono text-[10px] text-white/25 uppercase tracking-widest mb-3'>Tokens in Space</div>
        <div className='grid grid-cols-4 gap-2'>
          {statCards.map(({ label, value, sub }) => (
            <div key={label} className='bg-neutral-800 border border-white/10 rounded-lg p-3 text-center'>
              <div className='font-mono text-lg text-white'>{value === null ? '...' : value.toLocaleString()}</div>
              <div className='font-mono text-[9px] text-white/30 uppercase tracking-widest mt-0.5'>{label}</div>
              <div className='font-mono text-[8px] text-white/15 mt-0.5'>{sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Wallet balances */}
      <div>
        <div className='font-mono text-[10px] text-white/25 uppercase tracking-widest mb-3'>Wallet Balances</div>
        <div className='space-y-1.5'>
          {[
            {
              label: 'Treasury / Authority',
              address: TREASURY.toString(),
              sol: treasury.sol,
              token: { label: '$ASTRDS', val: treasury.astrds },
              note: 'Convex authority · holds deposited tokens',
            },
            {
              label: 'Deployer',
              address: DEPLOYER.toString(),
              sol: deployer.sol,
              token: null,
              note: 'Upgrade authority · operational · operator · buyback',
            },
          ].map(({ label, address, sol, token, note }) => (
            <div key={address} className='bg-neutral-800 border border-white/10 rounded-lg p-4'>
              <div className='flex items-start justify-between gap-3'>
                <div className='min-w-0'>
                  <div className='flex items-center gap-2 mb-0.5'>
                    <span className='font-mono text-xs text-white/70'>{label}</span>
                    <a href={EXPLORER(address)} target='_blank' rel='noopener noreferrer' className='text-white/20 hover:text-white/60 transition-colors'>
                      <ExternalLink size={10} />
                    </a>
                  </div>
                  <div className='font-mono text-[9px] text-white/25 truncate'>{address}</div>
                  <div className='font-mono text-[9px] text-white/15 mt-0.5'>{note}</div>
                </div>
                <div className='text-right shrink-0 space-y-0.5'>
                  <div className='font-mono text-sm'><Bal val={sol} suffix='SOL' /></div>
                  {token && <div className='font-mono text-xs'><Bal val={token.val} suffix={token.label} decimals={0} /></div>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* VaultConfig on-chain */}
      <div>
        <div className='font-mono text-[10px] text-white/25 uppercase tracking-widest mb-3'>On-Chain Config</div>
        <div className='bg-neutral-800 border border-white/10 rounded-lg p-4 space-y-2'>
          {[
            { label: 'Program', value: '4bRZK8XfziVhLCgvtRdFJyTgN6tXGSPJT8xfbtt1AxBB' },
            { label: 'VaultConfig PDA', value: '6zsWYibNCYYQJikHv8BHXRNynEACgFKsZPNXqWqBPbvv' },
          ].map(({ label, value }) => (
            <div key={label} className='flex items-start justify-between gap-4'>
              <span className='font-mono text-[10px] text-white/30 shrink-0'>{label}</span>
              <a href={EXPLORER(value)} target='_blank' rel='noopener noreferrer'
                className='font-mono text-[10px] text-game-blue/50 hover:text-game-blue transition-colors break-all text-right'>
                {value}
              </a>
            </div>
          ))}
        </div>
      </div>

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
