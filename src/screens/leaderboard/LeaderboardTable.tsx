// src/screens/leaderboard/LeaderboardTable.tsx
import React, { useMemo } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import AvatarDisplay from '@/components/common/AvatarDisplay'

type Score = {
  walletAddress: string
  score: number
  date?: string
}

type LeaderboardTableProps = {
  scores: Score[]
  loading: boolean
}

const shortenAddress = (address: string) => {
  if (!address || address === 'Anonymous') return 'Anonymous'
  return `${address.slice(0, 4)}...${address.slice(-4)}`
}

const formatDate = (dateString?: string) => {
  if (!dateString) return '—'
  return new Date(dateString).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

const RANK_BADGES: Record<number, { label: string; className: string }> = {
  0: { label: '1st', className: 'bg-yellow-400/10 text-yellow-400 border-yellow-400/40' },
  1: { label: '2nd', className: 'bg-gray-300/10 text-gray-300 border-gray-300/40' },
  2: { label: '3rd', className: 'bg-orange-400/10 text-orange-400 border-orange-400/40' },
}

const LoadingSkeleton = () => (
  <div className='animate-pulse space-y-3'>
    {[...Array(6)].map((_, i) => (
      <div key={i} className='grid grid-cols-4 gap-4 px-4 py-3 bg-white/5'>
        <div className='h-5 bg-white/10' />
        <div className='h-5 bg-white/10' />
        <div className='h-5 bg-white/10' />
        <div className='h-5 bg-white/10' />
      </div>
    ))}
  </div>
)

const ScoreRow = ({
  score,
  index,
  isCurrentUser,
  avatarUrl,
}: {
  score: Score
  index: number
  isCurrentUser: boolean
  avatarUrl?: string | null
}) => {
  const rankBadge = RANK_BADGES[index]

  return (
    <div
      className={`grid grid-cols-4 gap-4 px-4 py-2 transition-colors items-center
        ${isCurrentUser ? 'bg-game-blue/10 text-white' : 'text-gray-300 hover:bg-white/5'}
        ${index < 3 ? 'py-3' : ''}`}
    >
      <div className='flex items-center'>
        {rankBadge ? (
          <Badge className={rankBadge.className}>{rankBadge.label}</Badge>
        ) : (
          <span className='text-gray-500 text-sm'>#{index + 1}</span>
        )}
      </div>
      <div className='flex items-center gap-2'>
        <AvatarDisplay url={avatarUrl} address={score.walletAddress} size={22} />
        <span className='font-mono text-sm'>{shortenAddress(score.walletAddress)}</span>
        <a
          href={`https://solscan.io/account/${score.walletAddress}?cluster=devnet`}
          target='_blank'
          rel='noopener noreferrer'
          className='text-gray-500 hover:text-white transition-colors text-xs'
        >
          ⇗
        </a>
      </div>
      <div className='text-right font-mono'>{score.score.toLocaleString()}</div>
      <div className='text-right text-xs text-gray-500'>{formatDate(score.date)}</div>
    </div>
  )
}

const LeaderboardTable: React.FC<LeaderboardTableProps> = ({ scores, loading }) => {
  const wallet = useWallet()
  const isCurrentUser = (address: string) => wallet.publicKey?.toString() === address

  const uniqueWallets = useMemo(
    () => [...new Set(scores.map((s) => s.walletAddress))],
    [scores]
  )
  const avatarUrls = useQuery(
    api.players.getAvatarUrls,
    uniqueWallets.length > 0 ? { walletAddresses: uniqueWallets } : 'skip'
  ) ?? {}

  if (loading) return <LoadingSkeleton />

  if (scores.length === 0) {
    return <div className='text-center text-gray-500 py-8'>No scores yet — be the first!</div>
  }

  const topThree = scores.slice(0, 3)
  const rest = scores.slice(3)

  return (
    <div className='space-y-2'>
      <div className='grid grid-cols-4 gap-4 px-4 py-2 text-xs text-gray-500 uppercase tracking-wider'>
        <div>Rank</div>
        <div>Player</div>
        <div className='text-right'>Score</div>
        <div className='text-right'>Date</div>
      </div>

      <div className='space-y-1'>
        {topThree.map((score, i) => (
          <ScoreRow
            key={`${score.walletAddress}-${i}`}
            score={score}
            index={i}
            isCurrentUser={isCurrentUser(score.walletAddress)}
            avatarUrl={avatarUrls[score.walletAddress]}
          />
        ))}
      </div>

      {rest.length > 0 && <Separator className='bg-white/10 my-2' />}

      {rest.length > 0 && (
        <div className='max-h-48 overflow-y-auto space-y-1'>
          {rest.map((score, i) => (
            <ScoreRow
              key={`${score.walletAddress}-${i + 3}`}
              score={score}
              index={i + 3}
              isCurrentUser={isCurrentUser(score.walletAddress)}
              avatarUrl={avatarUrls[score.walletAddress]}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default LeaderboardTable
