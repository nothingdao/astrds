// src/screens/gameover/GameOverScreen.tsx
import React, { useEffect } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useGameData } from '../../stores/gameData'
import { useStateMachine } from '@/stores/stateMachine'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import GameTitle from '@/components/common/GameTitle'
import ScreenContainer from '@/components/common/ScreenContainer'
import { useInventoryStore } from '@/stores/inventoryStore'
import ASTRDSMinting from '@/components/tokens/ASTRDSMinting'
import { MachineState } from '@/types/machine'

const GameOverScreen: React.FC = () => {
  const wallet = useWallet()
  const score = useGameData((state) => state.score)
  const lastGameStats = useGameData((state) => state.lastGameStats)
  const tokens = useInventoryStore((state) => state.items.tokens)
  const endGameSession = useGameData((state) => state.endGameSession)
  const startTransition = useStateMachine((state) => state.startTransition)

  useEffect(() => {
    endGameSession().catch(console.error)
  }, [endGameSession])

  const handleReturnToTitle = async () => {
    try {
      await startTransition(MachineState.GAME_OVER, MachineState.INITIAL)
    } catch (error) {
      console.error('Failed to return to title:', error)
    }
  }

  return (
    <ScreenContainer screenType='GAME_OVER'>
      <div className='fixed inset-0 flex items-center justify-center z-40 bg-black/75 backdrop-blur-sm'>
        <div className='max-w-lg w-full mx-4 text-center'>
          <div className='bg-black/50 border border-white/20 p-8 animate-fadeIn space-y-6'>
            <GameTitle />
            <h1 className='text-game-red text-4xl'>GAME OVER</h1>

            <Separator className='bg-white/10' />

            <ASTRDSMinting tokenCount={tokens} />

            {lastGameStats?.isHighScore && (
              <Badge className='bg-yellow-400/10 text-yellow-400 border-yellow-400/50 text-sm px-4 py-1 animate-pulse'>
                NEW HIGH SCORE
              </Badge>
            )}

            {!lastGameStats?.isHighScore && lastGameStats?.rank <= 3 && (
              <Badge className='bg-game-blue/10 text-game-blue border-game-blue/50 text-sm px-4 py-1'>
                TOP 3
              </Badge>
            )}

            <div>
              <div className='text-sm text-gray-400 mb-1'>Final Score</div>
              <div className='text-3xl text-game-blue font-bold font-mono'>
                {score.toLocaleString()}
              </div>
            </div>

            {lastGameStats && (
              <div className='text-xs text-gray-500'>
                Rank #{lastGameStats.rank} of {lastGameStats.totalPlayers}
              </div>
            )}

            <Separator className='bg-white/10' />

            <Button
              variant='quarter'
              size='lg'
              onClick={handleReturnToTitle}
              disabled={!wallet.connected}
              className='w-full'
            >
              Play Again
            </Button>

            <p className='text-xs text-gray-600'>
              Tip: Practice makes perfect. Keep playing to improve your score.
            </p>
          </div>
        </div>
      </div>
    </ScreenContainer>
  )
}

export default GameOverScreen
