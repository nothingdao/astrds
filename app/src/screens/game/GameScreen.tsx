import React from 'react'
import { GameScreenProps } from '@/types/components/layout'
import ServerGameScreen from './ServerGameScreen'
import SpacePoolSync from '@/components/space/SpacePoolSync'

const GameScreen: React.FC<GameScreenProps> = ({ className }) => (
  <>
    <ServerGameScreen className={className} />
    <SpacePoolSync />
  </>
)

export default GameScreen
