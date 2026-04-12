// src/screens/account/AccountScreen.tsx
import React from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import {
  ExternalLink,
  Trophy,
  Clock,
  Target,
  Crosshair,
  Gamepad2,
  BarChart3,
  Award,
  Coins,
} from 'lucide-react'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { getTokenBalances } from '@/utils/tokenBalances'

const MINT_ADDRESS = '5sqKSHDKZr4KbNzj972PSfmEhtR9eLeBvv1nBRbeQAnB'

const MetricCard = ({ icon: Icon, label, value, sublabel }) => (
  <div className='bg-black/30 border border-white/10 rounded-lg p-4 hover:border-game-blue/50 transition-colors group'>
    <div className='flex items-start justify-between'>
      <div>
        <div className='text-xs text-gray-400 mb-1'>{label}</div>
        <div className='text-xl text-game-blue mb-1 font-mono'>{value}</div>
        {sublabel && (
          <div className='text-[10px] text-gray-500'>{sublabel}</div>
        )}
      </div>
      <Icon
        className='text-gray-600 group-hover:text-game-blue/50 transition-colors'
        size={20}
      />
    </div>
  </div>
)

const TokenBalance = ({ label, balance, symbol, address, loading }) => (
  <div className='bg-black/30 border border-white/10 rounded-lg p-4 hover:border-game-blue/50 transition-colors'>
    <div className='flex items-center justify-between'>
      <div>
        <div className='text-xs text-gray-400 mb-1'>{label}</div>
        <div className='text-xl text-game-blue font-mono'>
          {loading ? (
            <div className='h-6 w-20 bg-game-blue/10 animate-pulse rounded' />
          ) : balance !== undefined ? (
            `${balance.toLocaleString()} ${symbol}`
          ) : (
            '0 ${symbol}'
          )}
        </div>
      </div>
      {address && (
        <a
          href={`https://solscan.io/token/${address}`}
          target='_blank'
          rel='noopener noreferrer'
          className='text-gray-400 hover:text-white transition-colors'
        >
          <ExternalLink size={16} />
        </a>
      )}
    </div>
  </div>
)

const AccountScreen = ({ onClose }) => {
  const wallet = useWallet()
  const allScores = useQuery(api.scores.getScores) ?? []
  const [loading, setLoading] = React.useState(true)
  const [scores, setScores] = React.useState<Array<{ score: number; walletAddress: string; date?: string }>>([])
  const [tokenBalances, setTokenBalances] = React.useState<Record<string, number>>({
    SOL: 0,
    [MINT_ADDRESS]: 0,
  })
  const [stats, setStats] = React.useState({
    totalGames: 0,
    averageScore: 0,
    bestScore: 0,
    bestRank: null as number | null,
    accuracy: 0,
    totalPlayTime: 0,
    favoriteLevel: 1,
  })

  React.useEffect(() => {
    const loadStats = async () => {
      if (!wallet.publicKey || allScores.length === 0) return

      try {
        const walletAddress = wallet.publicKey.toString()
        const userScores = allScores.filter(
          (s) => s.walletAddress === walletAddress
        )

        // Load token balances
        const balances = await getTokenBalances(walletAddress, [MINT_ADDRESS])
        setTokenBalances(balances)

        if (userScores.length > 0) {
          const totalScore = userScores.reduce((sum, s) => sum + s.score, 0)
          const bestScore = Math.max(...userScores.map((s) => s.score))
          const bestRankIndex = allScores.findIndex(
            (s) => s.walletAddress === walletAddress && s.score === bestScore
          )

          setStats({
            totalGames: userScores.length,
            averageScore: Math.round(totalScore / userScores.length),
            bestScore,
            bestRank: bestRankIndex + 1,
            accuracy: Math.round(Math.random() * 30 + 70), // Simulated accuracy
            totalPlayTime: Math.round(userScores.length * 3.5), // Simulated playtime
            favoriteLevel: Math.round(Math.random() * 5 + 1), // Simulated favorite level
          })
          setScores(userScores.sort((a, b) => b.score - a.score).slice(0, 5))
        }
      } catch (error) {
        console.error('Error loading account stats:', error)
      } finally {
        setLoading(false)
      }
    }

    loadStats()
  }, [wallet.publicKey])

  if (!wallet.connected) {
    return (
      <div className='max-w-md mx-auto text-center'>
        <h2 className='text-2xl text-game-blue mb-4'>Account</h2>
        <p className='text-gray-400'>
          Connect your wallet to view your profile
        </p>
      </div>
    )
  }

  return (
    <div className='w-full max-h-[90vh] overflow-y-auto'>
      <div className='max-w-7xl mx-auto p-4'>
        <div className='grid grid-cols-1 md:grid-cols-12 gap-8'>
          {/* Left Column - Balances */}
          <div className='md:col-span-3 space-y-6'>
            {/* Token Balances Section */}
            <div className='bg-black/50 border border-game-blue/20 rounded-lg p-6'>
              <h2 className='text-xl text-game-blue mb-6 flex items-center gap-2'>
                <Coins size={20} />
                Wallet Balance
              </h2>
              <div className='space-y-4'>
                <TokenBalance
                  label='SOL Balance'
                  balance={tokenBalances.SOL}
                  symbol='SOL'
                  address=''
                  loading={loading}
                />
                <TokenBalance
                  label='ASTRDS Balance'
                  balance={tokenBalances[MINT_ADDRESS]}
                  symbol='ASTRDS'
                  address={MINT_ADDRESS}
                  loading={loading}
                />
              </div>
            </div>

            {/* Claim Balance Section */}
            <div className='bg-black/50 border border-game-blue/20 rounded-lg p-6'>
              <h2 className='text-xl text-game-blue mb-6 flex items-center gap-2'>
                <Award size={20} />
                Claim Balance
              </h2>
              <div className='space-y-4'>
                <TokenBalance
                  label='TEROIDS Balance'
                  // balance={tokenBalances.TEROIDS}
                  balance='420'
                  symbol='TEROIDS'
                  loading={false}
                />
              </div>
            </div>
          </div>

          {/* Center Column - Stats Grid and Recent Games */}
          <div className='md:col-span-6 space-y-6'>
            {/* Performance Stats Section */}
            <div className='bg-black/50 border border-game-blue/20 rounded-lg p-6'>
              <h2 className='text-xl text-game-blue mb-6 flex items-center gap-2'>
                <BarChart3 size={20} />
                Performance Stats
              </h2>
              <div className='grid grid-cols-2 gap-4'>
                <MetricCard
                  icon={Gamepad2}
                  label='Total Games'
                  value={stats.totalGames}
                  sublabel='Career games played'
                />
                <MetricCard
                  icon={Trophy}
                  label='Best Score'
                  value={stats.bestScore.toLocaleString()}
                  sublabel='Personal record'
                />
                <MetricCard
                  icon={Target}
                  label='Average Score'
                  value={stats.averageScore.toLocaleString()}
                  sublabel='Points per game'
                />
                <MetricCard
                  icon={Crosshair}
                  label='Accuracy'
                  value={`${stats.accuracy}%`}
                  sublabel='Hit ratio'
                />
                <MetricCard
                  icon={Clock}
                  label='Play Time'
                  value={`${stats.totalPlayTime}m`}
                  sublabel='Total time played'
                />
                <MetricCard
                  icon={Award}
                  label='Favorite Level'
                  value={stats.favoriteLevel}
                  sublabel='Most played level'
                />
              </div>
            </div>

            {/* Recent Games Section - Moved from right column */}
            <div className='bg-black/50 border border-game-blue/20 rounded-lg p-6'>
              <h2 className='text-xl text-game-blue mb-6 flex items-center gap-2'>
                <Clock size={20} />
                Recent Games
              </h2>
              <div className='space-y-3'>
                {scores.map((score, index) => (
                  <div
                    key={score.date}
                    className='bg-black/30 border border-white/10 rounded-lg p-3
                               hover:border-game-blue/30 transition-colors'
                  >
                    <div className='flex justify-between items-center mb-1'>
                      <span className='text-xs text-gray-400'>
                        {new Date(score.date).toLocaleDateString()}
                      </span>
                      <span className='text-xs text-gray-500'>
                        #{index + 1}
                      </span>
                    </div>
                    <div className='text-lg font-mono text-game-blue'>
                      {score.score.toLocaleString()}
                    </div>
                  </div>
                ))}
                {scores.length === 0 && (
                  <div className='text-center text-gray-500 text-sm py-4'>
                    No games played yet
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Player Info */}
          <div className='md:col-span-3 space-y-6'>
            {/* Profile Section */}
            <div className='bg-black/50 border border-game-blue/20 rounded-lg p-6'>
              <h2 className='text-xl text-game-blue mb-6 flex items-center gap-2'>
                <Trophy size={20} />
                Player Profile
              </h2>
              <div className='space-y-4'>
                <div className='text-center p-4 border border-white/5 rounded-lg bg-black/30'>
                  <div className='text-4xl text-game-blue font-mono mb-2'>
                    #{stats.bestRank || '??'}
                  </div>
                  <div className='text-xs text-gray-400'>Best Rank</div>
                </div>
                <div className='flex items-center justify-between text-sm'>
                  <span className='text-gray-400'>Wallet</span>
                  <div className='flex items-center gap-2'>
                    <span className='font-mono text-xs text-white/70'>
                      {wallet.publicKey?.toString().slice(0, 4)}...
                      {wallet.publicKey?.toString().slice(-4)}
                    </span>
                    <a
                      href={`https://solscan.io/account/${wallet.publicKey?.toString()}`}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='text-gray-400 hover:text-white transition-colors'
                    >
                      <ExternalLink size={14} />
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Achievement Badges */}
            <div className='bg-black/50 border border-white/10 rounded-lg p-6'>
              <h3 className='text-sm text-game-blue mb-4 flex items-center gap-2'>
                <Award size={16} />
                Achievements
              </h3>
              <div className='grid grid-cols-3 gap-2'>
                {[...Array(6)].map((_, i) => (
                  <div
                    key={i}
                    className='aspect-square rounded-lg bg-black/30 border border-white/5 flex items-center justify-center'
                  >
                    <div className='w-8 h-8 rounded-full bg-game-blue/10 animate-pulse' />
                  </div>
                ))}
              </div>
              <div className='text-center mt-4 text-xs text-gray-500'>
                More achievements coming soon!
              </div>
            </div>
          </div>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className='fixed top-4 right-4 text-gray-400 hover:text-white transition-colors'
        >
          <span className='text-2xl'>✕</span>
        </button>
      </div>
    </div>
  )
}

export default AccountScreen
