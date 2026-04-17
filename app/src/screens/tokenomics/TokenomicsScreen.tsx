import React, { useState, useEffect } from 'react'
import { PublicKey } from '@solana/web3.js'
import { connection } from '@/lib/solana'
import {
  Coins,
  Wallet,
  ExternalLink,
  Shield,
  Zap,
  ArrowRightLeft,
} from 'lucide-react'

const MINT_ADDRESS = new PublicKey('5sqKSHDKZr4KbNzj972PSfmEhtR9eLeBvv1nBRbeQAnB')
const TREASURY = new PublicKey('CNhWD1cXNaCMcjJmFcK25aFgV3ZTAFtyFDBvGfKZcpzF')
const EXPLORER = (addr: string) => `https://explorer.solana.com/address/${addr}?cluster=devnet`

const TokenomicsScreen = ({ onClose }: { onClose: () => void }) => {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalSupply: 0,
    holders: 0,
    treasuryBalance: 0,
  })

  useEffect(() => {
    const fetchTokenData = async () => {
      try {
        const [tokenSupply, accounts, treasuryBalance] = await Promise.all([
          connection.getTokenSupply(MINT_ADDRESS),
          connection.getTokenLargestAccounts(MINT_ADDRESS),
          connection.getBalance(TREASURY),
        ])
        setStats({
          totalSupply: tokenSupply.value.uiAmount || 0,
          holders: accounts.value.length || 0,
          treasuryBalance: treasuryBalance / 1e9,
        })
      } catch (error) {
        console.error('Failed to fetch token data:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchTokenData()
  }, [])

  return (
    <div className='p-5 space-y-6'>

      {/* Live stats */}
      <div className='grid grid-cols-3 gap-3'>
        {[
          {
            icon: Coins,
            label: 'Total Supply',
            value: loading ? '...' : stats.totalSupply.toLocaleString(),
            sub: '$ASTRDS minted',
            link: EXPLORER(MINT_ADDRESS.toString()),
          },
          {
            icon: Wallet,
            label: 'Holders',
            value: loading ? '...' : stats.holders.toLocaleString(),
            sub: 'unique wallets',
            link: null,
          },
          {
            icon: ArrowRightLeft,
            label: 'Treasury',
            value: loading ? '...' : `${stats.treasuryBalance.toFixed(3)} SOL`,
            sub: 'vault balance',
            link: EXPLORER(TREASURY.toString()),
          },
        ].map(({ icon: Icon, label, value, sub, link }) => (
          <div key={label} className='bg-black/30 border border-white/10 rounded-lg p-4 hover:border-game-blue/30 transition-colors'>
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

        {/* How $ASTRDS works */}
        <div className='bg-black/30 border border-white/10 rounded-lg p-5 space-y-4'>
          <h3 className='font-mono text-xs text-game-blue uppercase tracking-widest flex items-center gap-2'>
            <Zap size={13} />
            How $ASTRDS Works
          </h3>
          <div className='space-y-3 font-mono text-xs text-white/50'>
            <div className='flex gap-3'>
              <span className='text-game-blue/60 shrink-0'>01</span>
              <span>Pay ~$0.25 in SOL to insert a quarter and start a game</span>
            </div>
            <div className='flex gap-3'>
              <span className='text-game-blue/60 shrink-0'>02</span>
              <span>Collect $ASTRDS tokens floating in the asteroid field during gameplay</span>
            </div>
            <div className='flex gap-3'>
              <span className='text-game-blue/60 shrink-0'>03</span>
              <span>On game over, collected tokens are minted to your wallet — 1 collected = 1 $ASTRDS minted. No pre-mine. No team allocation. 100% earned through play.</span>
            </div>
          </div>
        </div>

        {/* Revenue split */}
        <div className='bg-black/30 border border-white/10 rounded-lg p-5 space-y-4'>
          <h3 className='font-mono text-xs text-game-blue uppercase tracking-widest flex items-center gap-2'>
            <ArrowRightLeft size={13} />
            Quarter Payment Split
          </h3>
          <div className='space-y-2'>
            {[
              { label: 'Operational', desc: 'Server costs, infrastructure', color: 'bg-game-blue' },
              { label: 'Operator', desc: 'Revenue', color: 'bg-purple-400' },
              { label: 'Buyback', desc: '$ASTRDS buyback pressure', color: 'bg-green-400' },
            ].map(({ label, desc, color }) => (
              <div key={label} className='flex items-center gap-3'>
                <div className={`w-1.5 h-1.5 rounded-full ${color} shrink-0`} />
                <div className='flex-1'>
                  <div className='font-mono text-xs text-white/60'>{label}</div>
                  <div className='font-mono text-[10px] text-white/25'>{desc}</div>
                </div>
              </div>
            ))}
          </div>
          <p className='font-mono text-[10px] text-white/20 border-t border-white/5 pt-3'>
            Split weights are admin-adjustable on-chain via the vault program.
          </p>
        </div>

        {/* Vault program */}
        <div className='bg-black/30 border border-white/10 rounded-lg p-5 space-y-4'>
          <h3 className='font-mono text-xs text-game-blue uppercase tracking-widest flex items-center gap-2'>
            <Shield size={13} />
            On-Chain Vault
          </h3>
          <div className='space-y-2 font-mono text-xs text-white/50'>
            <p>Your tokens never pass through our hands. Every deposit, claim, and payment settles directly on Solana — verifiable by anyone.</p>
          </div>
          <div className='space-y-1.5 font-mono text-[10px]'>
            <div>
              <div className='text-white/25 mb-0.5'>$ASTRDS Mint</div>
              <a href={EXPLORER(MINT_ADDRESS.toString())} target='_blank' rel='noopener noreferrer'
                className='text-game-blue/60 hover:text-game-blue transition-colors break-all'>
                {MINT_ADDRESS.toString()}
              </a>
            </div>
            <div>
              <div className='text-white/25 mb-0.5'>Treasury / Authority</div>
              <a href={EXPLORER(TREASURY.toString())} target='_blank' rel='noopener noreferrer'
                className='text-game-blue/60 hover:text-game-blue transition-colors break-all'>
                {TREASURY.toString()}
              </a>
            </div>
          </div>
        </div>

      </div>

      <p className='font-mono text-[9px] text-white/10 text-center uppercase tracking-widest'>
        Devnet — not real money
      </p>

    </div>
  )
}

export default TokenomicsScreen
