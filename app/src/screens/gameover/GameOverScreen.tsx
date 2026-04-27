// src/screens/gameover/GameOverScreen.tsx
import React, { useEffect, useRef } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useGameData } from '../../stores/gameData'
import { useStateMachine } from '@/stores/stateMachine'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import GameTitle from '@/components/common/GameTitle'
import { useInventoryStore } from '@/stores/inventoryStore'
import ASTRDSMinting from '@/components/tokens/ASTRDSMinting'
import SpaceTokenClaim from './SpaceTokenClaim'
import { MachineState } from '@/types/machine'
import { useServerStore } from '@/stores/serverStore'
import ScreenContainer from '@/components/common/ScreenContainer'
import { audioManager } from '@/services/audio/AudioManager'

const GameOverScreen: React.FC = () => {
  const wallet = useWallet()
  const score = useGameData((state) => state.score)
  const lastGameStats = useGameData((state) => state.lastGameStats)
  const astrdsEarned = useInventoryStore((state) => state.astrdsEarned)
  const currentSessionId = useGameData((state) => state.currentSessionId)
  const endGameSession = useGameData((state) => state.endGameSession)
  const submitFinalScore = useGameData((state) => state.submitFinalScore)
  const startTransition = useStateMachine((state) => state.startTransition)
  const selectedUrl = useServerStore((s) => s.selectedUrl)
  const playedScoreStingerRef = useRef(false)

  useEffect(() => {
    if (selectedUrl) {
      return
    }
    const walletAddress = wallet.publicKey?.toString()
    if (walletAddress) {
      submitFinalScore(walletAddress).catch(console.error)
    }
    endGameSession().catch(console.error)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (playedScoreStingerRef.current || !lastGameStats) return
    playedScoreStingerRef.current = true
    if (lastGameStats.rank === 1) {
      audioManager.playFromSfxBucket('newTopScore')
      audioManager.playFromStingerPlaylist('newTopScore')
    } else if (lastGameStats.isHighScore) {
      audioManager.playFromSfxBucket('personalBest')
      audioManager.playFromStingerPlaylist('personalBest')
    }
  }, [lastGameStats])

  const handleReturnToTitle = async () => {
    try {
      await startTransition(MachineState.GAME_OVER, MachineState.INITIAL)
    } catch (error) {
      console.error('Failed to return to title:', error)
    }
  }

  return (
    <ScreenContainer screenType='GAME_OVER' mode='fullscreen' className='z-40'>
      <div className='w-full h-full flex items-center justify-center px-4 pt-24 pb-10 overflow-y-auto'>
        <div className='max-w-lg w-full mx-auto text-center bg-surface-overlay border border-edge-medium p-8 animate-fadeIn space-y-6'>
          <GameTitle />
          <h1 className='text-destructive text-4xl'>GAME OVER</h1>

          <Separator className='bg-surface-subtle' />

          <ASTRDSMinting tokenCount={astrdsEarned} gameSessionId={currentSessionId} />
          <SpaceTokenClaim />

          {lastGameStats?.isHighScore && (
            <Badge className='bg-[var(--text-warning)]/10 text-tx-warning border-[var(--text-warning)]/50 text-sm px-4 py-1 animate-pulse'>
              NEW HIGH SCORE
            </Badge>
          )}

          {!lastGameStats?.isHighScore && lastGameStats?.rank <= 3 && (
            <Badge className='bg-primary/10 text-primary border-primary/50 text-sm px-4 py-1'>
              TOP 3
            </Badge>
          )}

          <div>
            <div className='text-sm text-muted-foreground mb-1'>Final Score</div>
            <div className='text-3xl text-primary font-bold font-mono'>
              {score.toLocaleString()}
            </div>
          </div>

          {lastGameStats && (
            <div className='text-xs text-muted-foreground'>
              Rank #{lastGameStats.rank} of {lastGameStats.totalPlayers}
            </div>
          )}

          <Separator className='bg-surface-subtle' />

          <Button
            variant='quarter'
            size='lg'
            onClick={handleReturnToTitle}
            disabled={!wallet.connected}
            className='w-full'
          >
            Play Again
          </Button>

          <p className='text-xs text-tx-dim'>
            Tip: Practice makes perfect. Keep playing to improve your score.
          </p>
        </div>
      </div>
    </ScreenContainer>
  )
}

export default GameOverScreen
