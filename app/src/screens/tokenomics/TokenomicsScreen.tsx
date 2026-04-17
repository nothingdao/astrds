import React, { useState, useEffect } from 'react'
import { PublicKey } from '@solana/web3.js'
import { connection } from '@/lib/solana'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import {
  Coins,
  Wallet,
  Users,
  CreditCard,
  Sparkles,
  CircleDollarSign,
  ExternalLink,
  Rocket,
} from 'lucide-react'

const MINT_ADDRESS = new PublicKey('5sqKSHDKZr4KbNzj972PSfmEhtR9eLeBvv1nBRbeQAnB')
const GAME_TREASURY = new PublicKey('AMKzF4Phzhp8htd9xerLSm1aderQT7t2v35HzbhDAjvE')

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
        const tokenSupply = await connection.getTokenSupply(MINT_ADDRESS)
        const accounts = await connection.getTokenLargestAccounts(MINT_ADDRESS)
        const treasuryBalance = await connection.getBalance(GAME_TREASURY)
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

  const activeDeposits = useQuery(api.spaceDeposits.getAllActiveSpaceDeposits)

  const StatCard = ({ icon: Icon, title, value, subtext, link }) => (
    <div className='bg-black/30 border border-white/10 rounded-lg p-6 hover:border-game-blue/50 transition-colors'>
      <div className='flex items-start justify-between mb-4'>
        <div>
          <h3 className='text-sm text-game-blue flex items-center gap-2'>
            <Icon size={16} />
            {title}
          </h3>
          <div className='text-2xl font-mono mt-2'>{value}</div>
        </div>
        {link && (
          <a href={link} target='_blank' rel='noopener noreferrer' className='text-gray-400 hover:text-white transition-colors'>
            <ExternalLink size={16} />
          </a>
        )}
      </div>
      {subtext && <div className='text-xs text-gray-400'>{subtext}</div>}
    </div>
  )

  const InfoSection = ({ title, children }) => (
    <div className='bg-black/30 border border-white/10 rounded-lg p-6'>
      <h3 className='text-sm text-game-blue mb-4'>{title}</h3>
      <div className='space-y-2 text-sm text-gray-300'>{children}</div>
    </div>
  )

  return (
    <div className='p-5 space-y-6'>
      <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
            <div className='space-y-6'>
              <div className='grid grid-cols-1 gap-4'>
                <StatCard
                  icon={Coins}
                  title='Total Supply'
                  value={loading ? '...' : `${stats.totalSupply.toLocaleString()} $ASTRD`}
                  subtext='Tokens are minted through gameplay'
                  link={`https://orbmarkets.io/address/${MINT_ADDRESS.toString()}`}
                />
                <StatCard
                  icon={Users}
                  title='Token Holders'
                  value={loading ? '...' : stats.holders.toLocaleString()}
                  subtext='Unique wallet addresses holding $ASTRD'
                />
                <StatCard
                  icon={Wallet}
                  title='Game Treasury'
                  value={loading ? '...' : `${stats.treasuryBalance.toLocaleString()} SOL`}
                  subtext='Balance from game fees'
                  link={`https://orbmarkets.io/address/${GAME_TREASURY.toString()}`}
                />
              </div>
            </div>

            <div className='space-y-6'>
              <InfoSection title='Token Utility'>
                <div className='space-y-4'>
                  <div className='flex items-start gap-3'>
                    <CreditCard className='text-game-blue mt-1' size={16} />
                    <p>Pay game fees with $ASTRD instead of SOL (1000 $ASTRD = 0.05 SOL)</p>
                  </div>
                  <div className='flex items-start gap-3'>
                    <CircleDollarSign className='text-game-blue mt-1' size={16} />
                    <p>Mine $ASTRD by collecting tokens during gameplay</p>
                  </div>
                  <div className='flex items-start gap-3'>
                    <Sparkles className='text-game-blue mt-1' size={16} />
                    <p>Future utility: cosmetic upgrades, special game modes, DAO governance</p>
                  </div>
                </div>
              </InfoSection>

              <InfoSection title='Token Distribution'>
                <ul className='list-disc list-inside space-y-2'>
                  <li>No pre-mine or team allocation</li>
                  <li>100% of tokens are earned through gameplay</li>
                  <li>1 collected token = 1 $ASTRD minted</li>
                  <li>Maximum 200 tokens can be collected per game</li>
                </ul>
              </InfoSection>

              <InfoSection title='Contract Addresses'>
                <div className='space-y-2 font-mono text-xs'>
                  <div>
                    <div className='text-gray-400 mb-1'>Token Address:</div>
                    <a
                      href={`https://orbmarkets.io/address/${MINT_ADDRESS.toString()}`}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='text-game-blue hover:text-white transition-colors break-all'
                    >
                      {MINT_ADDRESS.toString()}
                    </a>
                  </div>
                  <div>
                    <div className='text-gray-400 mb-1'>Treasury Address:</div>
                    <a
                      href={`https://orbmarkets.io/address/${GAME_TREASURY.toString()}`}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='text-game-blue hover:text-white transition-colors break-all'
                    >
                      {GAME_TREASURY.toString()}
                    </a>
                  </div>
                </div>
              </InfoSection>
            </div>
      </div>

      {/* Tokens in Space */}
      <div className='bg-black/30 border border-purple-500/20 rounded-lg p-6'>
        <h3 className='text-sm text-purple-400 flex items-center gap-2 mb-4'>
          <Rocket size={16} />
          Tokens in Space
        </h3>
        {!activeDeposits ? (
          <p className='text-xs text-white/30 font-mono'>Loading...</p>
        ) : activeDeposits.length === 0 ? (
          <p className='text-xs text-white/30 font-mono'>
            No tokens currently in space. Launch some from your wallet using the Space button above.
          </p>
        ) : (
          <div className='space-y-3'>
            <p className='text-xs text-white/40 font-mono mb-3'>
              {activeDeposits.length} token type{activeDeposits.length !== 1 ? 's' : ''} available in the game world
            </p>
            <div className='grid grid-cols-1 gap-2'>
              {activeDeposits.map((d) => (
                <div
                  key={d._id}
                  className='flex items-center justify-between bg-black/30 border border-white/10 rounded p-3'
                >
                  <div className='flex items-center gap-3'>
                    {d.logoUri ? (
                      <img src={d.logoUri} alt={d.symbol} className='w-6 h-6 rounded-full object-cover' />
                    ) : (
                      <div className='w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center'>
                        <span className='text-[8px] font-mono text-purple-400'>{d.symbol.slice(0, 2)}</span>
                      </div>
                    )}
                    <div>
                      <div className='font-mono text-sm text-white'>{d.symbol}</div>
                      <div className='font-mono text-[10px] text-white/30'>{d.name}</div>
                    </div>
                  </div>
                  <div className='text-right font-mono text-xs text-white/50 space-y-0.5'>
                    <div className='text-purple-300'>
                      {(d.remainingAmount / 10 ** (d.decimals ?? 0)).toLocaleString(undefined, { maximumFractionDigits: 4 })} remaining
                    </div>
                    <div>
                      {(d.tokensPerPill / 10 ** (d.decimals ?? 0)).toLocaleString(undefined, { maximumFractionDigits: 4 })}/pill · L{d.minLevel}–{d.maxLevel}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default TokenomicsScreen
