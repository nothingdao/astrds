// src/screens/account/AccountScreen.tsx
import React, { useCallback, useRef, useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { ExternalLink, Camera, Coins } from 'lucide-react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { getTokenBalances } from '@/utils/tokenBalances'
import AvatarDisplay from '@/components/common/AvatarDisplay'
import SpaceTokenClaim from '@/screens/gameover/SpaceTokenClaim'
import TokenManager from '@/components/account/TokenManager'
import { useArrowTabNav } from '@/hooks/useArrowTabNav'

type AccountTab = 'account' | 'tokens'
const ACCOUNT_TABS: AccountTab[] = ['account', 'tokens']
const MINT_ADDRESS = '5sqKSHDKZr4KbNzj972PSfmEhtR9eLeBvv1nBRbeQAnB'
const ORB = (addr: string) => `https://orbmarkets.io/address/${addr}?cluster=devnet`

const SectionLabel: React.FC<{ children: React.ReactNode; first?: boolean }> = ({ children, first }) => (
  <div className={`font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground ${first ? 'pt-3' : 'pt-5'} pb-1.5`}>
    {children}
  </div>
)

const StatRow: React.FC<{ label: string; value: React.ReactNode; link?: string }> = ({ label, value, link }) => (
  <div className='flex items-center justify-between py-1.5 border-b border-border'>
    <span className='font-mono text-xs text-tx-secondary'>{label}</span>
    <div className='flex items-center gap-1.5'>
      <span className='font-mono text-xs text-foreground'>{value}</span>
      {link && (
        <a href={link} target='_blank' rel='noopener noreferrer'>
          <ExternalLink size={9} className='text-muted-foreground hover:text-tx-secondary transition-colors' />
        </a>
      )}
    </div>
  </div>
)

const AccountScreen = ({ onClose }: { onClose: () => void }) => {
  const wallet = useWallet()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [activeTab, setActiveTab] = useState<AccountTab>('account')
  const setActiveTabCb = useCallback((t: AccountTab) => setActiveTab(t), [])
  useArrowTabNav(ACCOUNT_TABS, activeTab, setActiveTabCb)

  const allScores = useQuery(api.scores.getScores) ?? []
  const claimsHistory = useQuery(
    api.spaceDeposits.getClaimsByWallet,
    wallet.publicKey ? { playerWalletAddress: wallet.publicKey.toString() } : 'skip'
  ) ?? []
  const pendingCollections = useQuery(
    api.spaceDeposits.getPendingCollectionsByWallet,
    wallet.publicKey ? { playerWalletAddress: wallet.publicKey.toString() } : 'skip'
  ) ?? []
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

  const [loading, setLoading] = useState(true)
  const [tokenBalances, setTokenBalances] = useState<Record<string, number>>({
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
      <div className='p-10 text-center'>
        <p className='font-mono text-xs text-muted-foreground'>Connect your wallet to view your profile</p>
      </div>
    )
  }

  const walletAddress = wallet.publicKey?.toString() ?? ''
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
  const leaderboardRank = allScores.findIndex((s) => s.walletAddress === walletAddress)
  const bestRank = leaderboardRank >= 0 ? leaderboardRank + 1 : null
  const recentGames = [...endedSessions]
    .sort((a, b) => new Date(b.sessionStart).getTime() - new Date(a.sessionStart).getTime())
    .slice(0, 8)

  const TAB_DEFS = [
    { id: 'account' as AccountTab, label: 'Account', icon: undefined },
    { id: 'tokens'  as AccountTab, label: 'Tokens',  icon: Coins     },
  ]

  return (
    <div className='flex flex-col h-full'>
      {/* Profile strip */}
      <div className='flex items-center gap-3 px-5 py-2.5 border-b border-border shrink-0'>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className='relative group shrink-0'
          title='Upload avatar'
        >
          <AvatarDisplay url={avatarUrl} address={walletAddress} size={28} />
          <div className='absolute inset-0 rounded-full bg-surface-overlay opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity'>
            {uploading
              ? <span className='text-[8px] text-foreground animate-pulse'>...</span>
              : <Camera size={9} className='text-foreground' />
            }
          </div>
        </button>
        <span className='font-mono text-[10px] text-tx-tertiary flex-1 min-w-0 truncate'>{walletAddress}</span>
        <div className='flex items-center gap-2 shrink-0'>
          {bestRank && <span className='font-mono text-xs text-tx-secondary'>#{bestRank}</span>}
          <a href={ORB(walletAddress)} target='_blank' rel='noopener noreferrer'>
            <ExternalLink size={11} className='text-tx-dim hover:text-tx-secondary transition-colors' />
          </a>
        </div>
      </div>

      {/* Sub-tab bar */}
      <div className='flex items-stretch border-b border-border shrink-0'>
        {TAB_DEFS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 font-mono text-[10px] uppercase tracking-widest border-b-2 -mb-px transition-colors ${
              activeTab === id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-tx-secondary'
            }`}
          >
            {Icon && <Icon size={10} />}
            {label}
          </button>
        ))}
      </div>

      {/* Tokens tab */}
      {activeTab === 'tokens' && (
        <div className='flex-1 overflow-y-auto min-h-0'>
          <TokenManager />
        </div>
      )}

      {/* Account tab */}
      {activeTab === 'account' && (
        <div className='flex-1 overflow-y-auto min-h-0'>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-x-8 px-5'>

            {/* Left: Wallet + Performance */}
            <div>
              <SectionLabel first>Wallet</SectionLabel>
              <StatRow
                label='SOL'
                value={loading ? '...' : (tokenBalances.SOL ?? 0).toLocaleString()}
              />
              <StatRow
                label='ASTRDS'
                value={loading ? '...' : (tokenBalances[MINT_ADDRESS] ?? 0).toLocaleString()}
                link={ORB(MINT_ADDRESS)}
              />

              <SectionLabel>Performance</SectionLabel>
              <StatRow label='Games Played' value={totalGames || '—'} />
              <StatRow label='Best Score'   value={bestScore    ? bestScore.toLocaleString()    : '—'} />
              <StatRow label='Avg Score'    value={averageScore ? averageScore.toLocaleString() : '—'} />
              <StatRow label='Play Time'    value={totalPlayMin ? `${totalPlayMin}m`            : '—'} />
              <StatRow label='Best Rank'    value={bestRank     ? `#${bestRank}`                : '—'} />
            </div>

            {/* Right: Recent Games + Claims */}
            <div>
              <SectionLabel first>Recent Games</SectionLabel>
              <div className='flex items-center py-1 border-b border-border'>
                <span className='font-mono text-[10px] uppercase tracking-widest text-tx-tertiary flex-1'>Date</span>
                <span className='font-mono text-[10px] uppercase tracking-widest text-tx-tertiary w-20 text-right'>Score</span>
                <span className='font-mono text-[10px] uppercase tracking-widest text-tx-tertiary w-12 text-right'>Level</span>
              </div>
              {recentGames.length === 0 ? (
                <div className='font-mono text-xs text-tx-tertiary py-3'>No games yet</div>
              ) : recentGames.map((session) => (
                <div key={session._id} className='flex items-center py-1.5 border-b border-border hover:bg-surface-subtle'>
                  <span className='font-mono text-xs text-tx-secondary flex-1'>
                    {new Date(session.sessionStart).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                  <span className='font-mono text-xs text-foreground w-20 text-right'>
                    {session.score.toLocaleString()}
                  </span>
                  <span className='font-mono text-xs text-tx-secondary w-12 text-right'>
                    L{session.levelReached}
                  </span>
                </div>
              ))}

              <SectionLabel>Space Token Claims</SectionLabel>
              <SpaceTokenClaim />
              {claimsHistory
                .filter((c) => !c.txSignature.startsWith('dev-claim-'))
                .slice(0, 10)
                .map((claim) => {
                  const displayAmount = (claim.amount / Math.pow(10, claim.decimals))
                    .toLocaleString(undefined, { maximumFractionDigits: 2 })
                  return (
                    <div key={claim._id} className='flex items-center py-1.5 border-b border-border hover:bg-surface-subtle'>
                      <div className='flex items-center gap-1.5 flex-1 min-w-0'>
                        {claim.logoUri && (
                          <img src={claim.logoUri} alt={claim.symbol} className='w-3.5 h-3.5 rounded-full shrink-0' />
                        )}
                        <span className='font-mono text-xs text-tx-secondary truncate'>{claim.symbol}</span>
                      </div>
                      <span className='font-mono text-xs text-foreground px-3'>+{displayAmount}</span>
                      <div className='flex items-center gap-1.5 shrink-0'>
                        <span className='font-mono text-xs text-tx-secondary'>
                          {new Date(claim.claimedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                        <a
                          href={`https://orbmarkets.io/tx/${claim.txSignature}?cluster=devnet`}
                          target='_blank'
                          rel='noopener noreferrer'
                        >
                          <ExternalLink size={9} className='text-tx-dim hover:text-tx-secondary transition-colors' />
                        </a>
                      </div>
                    </div>
                  )
                })}
              {claimsHistory.length === 0 && pendingCollections.length === 0 && (
                <div className='font-mono text-xs text-tx-tertiary py-3'>No claims yet</div>
              )}
            </div>
          </div>

        </div>
      )}

      <input ref={fileInputRef} type='file' accept='image/*' className='hidden' onChange={handleAvatarUpload} />
    </div>
  )
}

export default AccountScreen
