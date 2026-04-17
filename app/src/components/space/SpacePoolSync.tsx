// src/components/space/SpacePoolSync.tsx
// Syncs active space deposit pools from Convex into the engine store.
// Mount this during gameplay so the engine knows which pools to sample from.
import React, { useEffect } from 'react'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { useLevelStore } from '@/stores/levelStore'
import { useSpaceTokenStore } from '@/stores/spaceTokenStore'

const SpacePoolSync: React.FC = () => {
  const level = useLevelStore((s) => s.level)
  const pools = useQuery(api.spaceDeposits.getActivePoolsForLevel, { level })
  const setActivePools = useSpaceTokenStore((s) => s.setActivePools)

  useEffect(() => {
    if (pools) setActivePools(pools as any)
  }, [pools, setActivePools])

  return null
}

export default SpacePoolSync
