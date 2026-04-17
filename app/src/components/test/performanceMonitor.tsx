import { useState, useEffect, useRef } from 'react'
import { useEngineStore } from '@/stores/engineStore'
import { ChevronUp, ChevronDown, Activity } from 'lucide-react'
import React from 'react'

export default function PerformanceMonitor() {
  const [isExpanded, setIsExpanded] = useState(false)
  const performance = useEngineStore((state) => state.performance)
  const debugIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Debug logging effect
  useEffect(() => {
    // Debug logging function
    const logDebugInfo = () => {
      const state = useEngineStore.getState()
      console.log('Performance Debug:', {
        fps: state.performance.fps,
        frameTime: state.performance.frameTime.toFixed(2) + 'ms',
        entities: state.performance.entityCounts,
        frameCount: state.performance.frameCount,
        timestamp: new Date().toISOString(),
      })
    }

    // Set up periodic logging
    debugIntervalRef.current = setInterval(logDebugInfo, 5000)

    // Cleanup
    return () => {
      if (debugIntervalRef.current) {
        clearInterval(debugIntervalRef.current)
      }
    }
  }, [])

  // Color indicators based on performance thresholds
  const getFPSColor = (fps: number) => {
    if (fps >= 55) return 'text-green-400'
    if (fps >= 30) return 'text-yellow-400'
    return 'text-red-400'
  }

  const getFrameTimeColor = (frameTime: number) => {
    if (frameTime <= 16.67) return 'text-green-400'
    if (frameTime <= 33.33) return 'text-yellow-400'
    return 'text-red-400'
  }

  const getEntityCountColor = (count: number) => {
    if (count <= 50) return 'text-green-400'
    if (count <= 100) return 'text-yellow-400'
    return 'text-red-400'
  }

  const totalEntities = Object.values(performance.entityCounts).reduce(
    (sum, count) => sum + count,
    0
  )

  return (
    <div className="fixed left-4 bottom-4 z-50">
      <div
        className={`
          bg-black/80 border border-game-blue rounded-lg p-4
          transition-all duration-200 ease-in-out
          ${isExpanded ? 'w-64' : 'w-36'}
        `}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center space-x-2">
            <Activity size={16} className="text-game-blue" />
            <span className="text-sm font-medium text-game-blue">Performance</span>
          </div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-gray-400 hover:text-white transition-colors"
          >
            {isExpanded ? (
              <ChevronDown size={16} />
            ) : (
              <ChevronUp size={16} />
            )}
          </button>
        </div>

        {/* Basic Metrics - Always visible */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-400">FPS</span>
            <span className={`font-mono ${getFPSColor(performance.fps)}`}>
              {performance.fps}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-400">Frame Time</span>
            <span
              className={`font-mono ${getFrameTimeColor(performance.frameTime)}`}
            >
              {performance.frameTime.toFixed(1)}ms
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-400">Entities</span>
            <span
              className={`font-mono ${getEntityCountColor(totalEntities)}`}
            >
              {totalEntities}
            </span>
          </div>
        </div>

        {/* Expanded Metrics */}
        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-white/10 space-y-4">
            {/* Entity Breakdown */}
            <div>
              <h3 className="text-xs text-gray-400 mb-2">Entity Counts</h3>
              <div className="space-y-1">
                {Object.entries(performance.entityCounts).map(([type, count]) => (
                  <div
                    key={type}
                    className="flex justify-between items-center"
                  >
                    <span className="text-xs text-gray-400 capitalize">
                      {type}
                    </span>
                    <span className={`font-mono ${getEntityCountColor(count)}`}>
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Frame Stats */}
            <div>
              <h3 className="text-xs text-gray-400 mb-2">Frame Stats</h3>
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-400">Frame Count</span>
                  <span className="font-mono text-gray-300">
                    {performance.frameCount}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-400">Last Update</span>
                  <span className="font-mono text-gray-300">
                    {Math.round(performance.lastFrameTimestamp)}ms
                  </span>
                </div>
              </div>
            </div>

            {/* Legend */}
            <div className="text-xs text-gray-500">
              <p>Target: 60 FPS (16.67ms)</p>
              <p>Current: {performance.fps} FPS ({performance.frameTime.toFixed(1)}ms)</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
