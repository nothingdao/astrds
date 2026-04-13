// src/screens/account/AccountScreen.tsx
import React, { useRef, useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import {
  ExternalLink,
  Trophy,
  Clock,
  Target,
  Gamepad2,
  BarChart3,
  Award,
  Coins,
  Camera,
} from 'lucide-react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { getTokenBalances } from '@/utils/tokenBalances'
import { Button } from '@/components/ui/button'
import AvatarDisplay from '@/components/common/AvatarDisplay'

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

const TokenBalance = ({ label, balance, symbol, address, loading, icon = null }) => (
  <div className='bg-black/30 border border-white/10 rounded-lg p-4 hover:border-game-blue/50 transition-colors'>
    <div className='flex items-center justify-between'>
      <div className='flex items-center gap-3'>
        {icon && <div className='shrink-0'>{icon}</div>}
        <div>
          <div className='text-xs text-gray-400 mb-1'>{label}</div>
          <div className='text-xl text-game-blue font-mono'>
            {loading ? (
              <div className='h-6 w-20 bg-game-blue/10 animate-pulse rounded' />
            ) : (
              `${(balance ?? 0).toLocaleString()} ${symbol}`
            )}
          </div>
        </div>
      </div>
      {address && (
        <a
          href={`https://orbmarkets.io/address/${address}?cluster=devnet`}
          target='_blank'
          rel='noopener noreferrer'
          className='text-gray-400 hover:text-white transition-colors shrink-0'
        >
          <ExternalLink size={16} />
        </a>
      )}
    </div>
  </div>
)

const AccountScreen = ({ onClose }) => {
  const wallet = useWallet()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const allScores = useQuery(api.scores.getScores) ?? []
  const gameSessions = useQuery(
    api.gameSessions.getByWallet,
    wallet.publicKey ? { walletAddress: wallet.publicKey.toString() } : 'skip'
  ) ?? []

  const generateUploadUrl = useMutation(api.players.generateUploadUrl)
  const saveAvatarMutation = useMutation(api.players.saveAvatar)
  const avatarUrl = useQuery(
    api.players.getAvatarUrl,
    wallet.publicKey ? { walletAddress: wallet.publicKey.toString() } : 'skip'
  )

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !wallet.publicKey) return
    setUploading(true)
    try {
      const uploadUrl = await generateUploadUrl()
      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': file.type },
        body: file,
      })
      const { storageId } = await res.json()
      await saveAvatarMutation({ walletAddress: wallet.publicKey.toString(), storageId })
    } catch (err) {
      console.error('Avatar upload failed:', err)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const [loading, setLoading] = React.useState(true)
  const [tokenBalances, setTokenBalances] = React.useState<Record<string, number>>({
    SOL: 0,
    [MINT_ADDRESS]: 0,
  })

  React.useEffect(() => {
    if (!wallet.publicKey) return
    let cancelled = false

    getTokenBalances(wallet.publicKey.toString(), [MINT_ADDRESS]).then((balances) => {
      if (!cancelled) {
        setTokenBalances(balances)
        setLoading(false)
      }
    })

    return () => { cancelled = true }
  }, [wallet.publicKey])

  if (!wallet.connected) {
    return (
      <div className='max-w-md mx-auto text-center'>
        <h2 className='text-2xl text-game-blue mb-4'>Account</h2>
        <p className='text-gray-400'>Connect your wallet to view your profile</p>
      </div>
    )
  }

  const walletAddress = wallet.publicKey?.toString() ?? ''

  // Stats derived from real data
  const endedSessions = gameSessions.filter((s) => s.status === 'ended')
  const totalGames = endedSessions.length
  const bestScore = totalGames > 0 ? Math.max(...endedSessions.map((s) => s.score)) : 0
  const averageScore = totalGames > 0
    ? Math.round(endedSessions.reduce((sum, s) => sum + s.score, 0) / totalGames)
    : 0
  const totalPlayMs = endedSessions.reduce((sum, s) => {
    if (!s.sessionEnd) return sum
    return sum + (new Date(s.sessionEnd).getTime() - new Date(s.sessionStart).getTime())
  }, 0)
  const totalPlayMin = Math.round(totalPlayMs / 60000)

  const levelCounts = endedSessions.reduce<Record<number, number>>((acc, s) => {
    acc[s.levelReached] = (acc[s.levelReached] ?? 0) + 1
    return acc
  }, {})
  const favoriteLevel = Object.entries(levelCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'

  const leaderboardRank = allScores.findIndex((s) => s.walletAddress === walletAddress && s.score === bestScore)
  const bestRank = leaderboardRank >= 0 ? leaderboardRank + 1 : null

  const recentGames = [...endedSessions]
    .sort((a, b) => new Date(b.sessionStart).getTime() - new Date(a.sessionStart).getTime())
    .slice(0, 5)

  return (
    <div className='w-full max-h-[90vh] overflow-y-auto'>
      <div className='max-w-7xl mx-auto p-4'>
        <div className='grid grid-cols-1 md:grid-cols-12 gap-8'>

          {/* Left Column - Balances */}
          <div className='md:col-span-3 space-y-6'>
            <div className='bg-black/50 border border-game-blue/20 rounded-lg p-6'>
              <h2 className='text-xl text-game-blue mb-6 flex items-center gap-2'>
                <Coins size={20} />
                Wallet Balance
              </h2>
              <div className='space-y-4'>
                <TokenBalance
                  label='SOL'
                  balance={tokenBalances.SOL}
                  symbol='SOL'
                  address=''
                  loading={loading}
                />
                <TokenBalance
                  label='ASTRDS'
                  balance={tokenBalances[MINT_ADDRESS]}
                  symbol='ASTRDS'
                  address={MINT_ADDRESS}
                  loading={loading}
                  icon={
                    <img
                      src='/astrds.png'
                      alt='ASTRDS'
                      className='w-8 h-8 rounded-full object-cover'
                    />
                  }
                />
              </div>
            </div>
          </div>

          {/* Center Column - Stats + Recent Games */}
          <div className='md:col-span-6 space-y-6'>
            <div className='bg-black/50 border border-game-blue/20 rounded-lg p-6'>
              <h2 className='text-xl text-game-blue mb-6 flex items-center gap-2'>
                <BarChart3 size={20} />
                Performance Stats
              </h2>
              <div className='grid grid-cols-2 gap-4'>
                <MetricCard
                  icon={Gamepad2}
                  label='Total Games'
                  value={totalGames || '—'}
                  sublabel='Career games played'
                />
                <MetricCard
                  icon={Trophy}
                  label='Best Score'
                  value={bestScore ? bestScore.toLocaleString() : '—'}
                  sublabel='Personal record'
                />
                <MetricCard
                  icon={Target}
                  label='Average Score'
                  value={averageScore ? averageScore.toLocaleString() : '—'}
                  sublabel='Points per game'
                />
                <MetricCard
                  icon={Clock}
                  label='Play Time'
                  value={totalPlayMin ? `${totalPlayMin}m` : '—'}
                  sublabel='Total time played'
                />
                <MetricCard
                  icon={Award}
                  label='Favorite Level'
                  value={favoriteLevel}
                  sublabel='Most reached level'
                />
                <MetricCard
                  icon={Trophy}
                  label='Best Rank'
                  value={bestRank ? `#${bestRank}` : '—'}
                  sublabel='Leaderboard position'
                />
              </div>
            </div>

            <div className='bg-black/50 border border-game-blue/20 rounded-lg p-6'>
              <h2 className='text-xl text-game-blue mb-6 flex items-center gap-2'>
                <Clock size={20} />
                Recent Games
              </h2>
              <div className='space-y-3'>
                {recentGames.map((session) => (
                  <div
                    key={session._id}
                    className='bg-black/30 border border-white/10 rounded-lg p-3 hover:border-game-blue/30 transition-colors'
                  >
                    <div className='flex justify-between items-center mb-1'>
                      <span className='text-xs text-gray-400'>
                        {new Date(session.sessionStart).toLocaleDateString()}
                      </span>
                      <span className='text-xs text-gray-500'>
                        Level {session.levelReached}
                      </span>
                    </div>
                    <div className='text-lg font-mono text-game-blue'>
                      {session.score.toLocaleString()}
                    </div>
                  </div>
                ))}
                {recentGames.length === 0 && (
                  <div className='text-center text-gray-500 text-sm py-4'>
                    No games played yet
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Profile */}
          <div className='md:col-span-3 space-y-6'>
            <div className='bg-black/50 border border-game-blue/20 rounded-lg p-6'>
              <h2 className='text-xl text-game-blue mb-6 flex items-center gap-2'>
                <Trophy size={20} />
                Player Profile
              </h2>
              <div className='space-y-4'>
                {/* Avatar */}
                <div className='flex flex-col items-center gap-3'>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className='relative group'
                    title='Upload avatar'
                  >
                    <AvatarDisplay url={avatarUrl} address={walletAddress} size={80} />
                    <div className='absolute inset-0 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity'>
                      {uploading
                        ? <div className='text-xs text-white animate-pulse'>...</div>
                        : <Camera size={18} className='text-white' />
                      }
                    </div>
                  </button>
                  <p className='text-xs text-gray-500'>Click to upload avatar</p>
                  <input
                    ref={fileInputRef}
                    type='file'
                    accept='image/*'
                    className='hidden'
                    onChange={handleAvatarUpload}
                  />
                </div>

                <div className='text-center p-4 border border-white/5 rounded-lg bg-black/30'>
                  <div className='text-4xl text-game-blue font-mono mb-2'>
                    {bestRank ? `#${bestRank}` : '—'}
                  </div>
                  <div className='text-xs text-gray-400'>Best Rank</div>
                </div>
                <div className='flex items-center justify-between text-sm'>
                  <span className='text-gray-400'>Wallet</span>
                  <div className='flex items-center gap-2'>
                    <span className='font-mono text-xs text-white/70'>
                      {walletAddress.slice(0, 4)}...{walletAddress.slice(-4)}
                    </span>
                    <a
                      href={`https://orbmarkets.io/address/${walletAddress}?cluster=devnet`}
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
          </div>
        </div>

        <Button
          variant='ghost'
          size='icon'
          onClick={onClose}
          className='fixed top-4 right-4'
        >
          ✕
        </Button>
      </div>
    </div>
  )
}

export default AccountScreen
