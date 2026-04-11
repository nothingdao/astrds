// src/screens/gameover/GameOverScreen.tsx
import React, { useEffect } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useGameData } from '../../stores/gameData'
import { useStateMachine } from '@/stores/stateMachine'
import { QuarterButton } from '@/components/common/Buttons'
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

  useEffect(() => {
    endGameSession().catch(console.error)
  }, [endGameSession])

  const startTransition = useStateMachine(state => state.startTransition)

  // Replace handlePlayAgain with:
  const handleReturnToTitle = async () => {
    try {
      await startTransition(MachineState.GAME_OVER, MachineState.INITIAL)
    } catch (error) {
      console.error('Failed to return to title:', error)
    }
  }

  const renderAchievement = () => {
    if (!lastGameStats) return null

    if (lastGameStats.isHighScore) {
      return (
        <div className='text-yellow-400 text-2xl animate-pulse mb-4'>
          🏆 NEW HIGH SCORE! 🏆
        </div>
      )
    }

    if (lastGameStats.rank <= 3) {
      return (
        <div className='text-game-blue text-xl mb-4'>🌟 Top 3 Score! 🌟</div>
      )
    }

    return null
  }

  return (
    <ScreenContainer screenType='GAME_OVER'>
      <div className='fixed inset-0 flex items-center justify-center z-40 bg-black/75 backdrop-blur-sm'>
        <div className='max-w-lg w-full mx-4 text-center'>
          <div className='bg-black/50 border border-1 border-white p-8 animate-fadeIn'>
            <GameTitle />
            <h1 className='text-game-red text-4xl mb-8'>GAME OVER</h1>

            <ASTRDSMinting tokenCount={tokens} />

            {renderAchievement()}

            <div className='mb-8'>
              <div className='text-lg mb-2'>Final Score</div>
              <div className='text-2xl text-game-blue font-bold'>
                {score.toLocaleString()}
              </div>
            </div>

            {lastGameStats && (
              <div className='mb-8 space-y-2'>
                <div className='text-gray-400 text-xs'>
                  Rank: #{lastGameStats.rank} of {lastGameStats.totalPlayers}
                </div>
              </div>
            )}

            <div className='space-y-4'>
              <QuarterButton
                onClick={handleReturnToTitle}
                disabled={!wallet.connected}
              >
                Play Again
              </QuarterButton>
            </div>

            <div className='mt-8 text-xs text-gray-500'>
              Tip: Practice makes perfect! Keep playing to improve your score.
            </div>
          </div>
        </div>
      </div>
    </ScreenContainer>
  )
}

export default GameOverScreen
