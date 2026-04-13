import React, { useState, useEffect } from 'react'
import { PublicKey } from '@solana/web3.js'
import { connection } from '@/lib/solana'
import {
  Coins,
  Wallet,
  Users,
  CreditCard,
  Sparkles,
  CircleDollarSign,
  ExternalLink,
} from 'lucide-react'

const MINT_ADDRESS = new PublicKey('5sqKSHDKZr4KbNzj972PSfmEhtR9eLeBvv1nBRbeQAnB')
const GAME_TREASURY = new PublicKey('AMKzF4Phzhp8htd9xerLSm1aderQT7t2v35HzbhDAjvE')

const TokenomicsScreen = ({ onClose }) => {
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
    <div className='inset-0 z-40 flex items-center justify-center bg-black/75 backdrop-blur-sm'>
      <div className='w-full min-h-screen py-8 px-4 overflow-y-auto'>
        <div className='max-w-7xl mx-auto'>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-8'>
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
                    <p>Earn $ASTRD by collecting tokens during gameplay</p>
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
        </div>
      </div>
    </div>
  )
}

export default TokenomicsScreen
