// src/screens/leaderboard/LeaderboardScreen.tsx
import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import LeaderboardTable from './LeaderboardTable';
import { useGameData } from '../../stores/gameData';
import { LeaderboardScreenProps } from '@/types/components/leaderboard';
import { Score } from '@/types/core';
import { useStateMachine } from '@/stores/stateMachine';
import { MachineState } from '@/types/machine'
import { Separator } from '@/components/ui/separator'

const LeaderboardScreen: React.FC<LeaderboardScreenProps> = ({
  isOverlay = false,
  onClose,
  onPlayAgain
}) => {
  const wallet = useWallet();
  const topScore = useGameData((state) => state.topScore);
  const selectMachineState = useStateMachine((state) => state.setState);

  const highScoresRaw = useQuery(api.scores.getScores);
  const loading = highScoresRaw === undefined;
  const highScores = highScoresRaw ?? [];

  const [playerStats, setPlayerStats] = useState<{
    topScore: number;
    rank: number | null;
  }>({
    topScore: 0,
    rank: null,
  });

  useEffect(() => {
    if (!wallet.publicKey || highScores.length === 0) return;

    const walletAddress = wallet.publicKey.toString();
    const playerScores = highScores.filter((s) => s.walletAddress === walletAddress);

    if (playerScores.length > 0) {
      const bestScore = Math.max(...playerScores.map((s) => s.score));
      const bestRank = highScores.findIndex(
        (s) => s.walletAddress === walletAddress && s.score === bestScore
      ) + 1;

      setPlayerStats({
        topScore: bestScore,
        rank: bestRank > 0 ? bestRank : null,
      });
    }
  }, [wallet.publicKey, highScores]);

  const handleLocalPlayAgain = () => {
    if (onPlayAgain) {
      onPlayAgain();
    } else {
      selectMachineState(MachineState.READY_TO_PLAY);
    }
  };

  const formatRank = (rank: number | null) => {
    if (!rank) return null;
    const lastDigit = rank % 10;
    const lastTwoDigits = rank % 100;
    let suffix = 'th';
    if (lastTwoDigits < 11 || lastTwoDigits > 13) {
      switch (lastDigit) {
        case 1: suffix = 'st'; break;
        case 2: suffix = 'nd'; break;
        case 3: suffix = 'rd'; break;
      }
    }
    return `${rank}${suffix}`;
  };

  return (
    <div className='p-5'>
      <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
            <div className='space-y-6'>
              <div className='bg-neutral-800 border border-white/10 rounded-lg p-6'>
                <h2 className='font-mono text-xs text-game-blue uppercase tracking-widest mb-4'>Your Stats</h2>
                <div className='space-y-4'>
                  {wallet.connected ? (
                    <>
                      <div className='flex justify-between items-center'>
                        <span className='font-mono text-xs text-white/50'>Your Top Score:</span>
                        <span className='font-mono text-lg text-white'>
                          {playerStats.topScore.toLocaleString()}
                        </span>
                      </div>
                      {playerStats.rank && (
                        <div className='flex justify-between items-center'>
                          <span className='font-mono text-xs text-white/50'>Your Best Rank:</span>
                          <span className='font-mono text-lg text-white'>
                            {formatRank(playerStats.rank)}
                          </span>
                        </div>
                      )}
                      {!playerStats.rank && playerStats.topScore > 0 && (
                        <div className='font-mono text-xs text-white/40 text-center'>
                          Keep playing to reach the top 10!
                        </div>
                      )}
                    </>
                  ) : (
                    <div className='font-mono text-xs text-white/40 text-center'>
                      Connect wallet to see your stats
                    </div>
                  )}
                </div>
              </div>

            </div>

            <div className='bg-neutral-800 border border-white/10 rounded-lg p-6 max-h-[70vh] overflow-y-auto'>
              <h2 className='font-mono text-xs text-game-blue uppercase tracking-widest mb-4'>
                Global Leaderboard{highScores.length > 0 && ` (Top ${highScores.length})`}
              </h2>
              <LeaderboardTable
                scores={highScores as Score[]}
                loading={loading}
              />
            </div>
      </div>
    </div>
  );
};

export default LeaderboardScreen;
