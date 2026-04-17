// src/components/sound/SoundSettings.tsx
import React from 'react'
import { X, RotateCcw, Volume2, Play } from 'lucide-react'
import { useAudio } from '@/hooks/useAudio'
import { useSettingsPanelStore } from '@/stores/settingsPanelStore'
import VolumeSlider from './VolumeSlider'
import EffectToggle from './EffectToggle'
import {
  SoundSettingsProps,
  EffectGroupProps,
  EFFECT_GROUPS,
  EFFECT_LABELS,
  EffectType
} from '@/types/components/sound'

const SoundSettings: React.FC<SoundSettingsProps> = ({ isOpen, onClose }) => {
  const {
    volumes,
    setVolume,
    effectSettings,
    setEffectSetting,
    isInitialized,
    resetSettings,
    playSound,
  } = useAudio()
  const { isOpen: isPanelOpen, close } = useSettingsPanelStore()

  if (!isInitialized || !isOpen) return null

  const handleTestSound = (effectType: EffectType) => {
    if (effectSettings[effectType] !== 'off') {
      playSound(effectType)
    }
  }

  const handleClose = () => {
    close() // Close through settings panel store
    onClose() // Close through overlay manager
  }

  const EffectGroup: React.FC<EffectGroupProps> = ({ groupName, effects }) => (
    <div key={groupName}>
      <h4 className='text-xs text-white/50 mb-3'>{groupName}</h4>
      <div className='space-y-2'>
        {effects.map((effect) => (
          <div
            key={effect}
            className='flex items-center gap-2'
          >
            <EffectToggle
              value={effectSettings[effect]}
              onChange={setEffectSetting}
              label={EFFECT_LABELS[effect as EffectType]}
              effectType={effect}
              className='flex-1'
            />
            <button
              onClick={() => handleTestSound(effect as EffectType)}
              disabled={effectSettings[effect] === 'off'}
              className={`px-2 py-1 rounded flex items-center gap-1 text-xs
                ${effectSettings[effect] === 'off'
                  ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                  : 'bg-game-blue/20 text-game-blue hover:bg-game-blue/30'
                }`}
              title={`Test ${EFFECT_LABELS[effect as EffectType]}`}
            >
              <Play size={12} />
              Test
            </button>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div className='max-w-4xl mx-auto w-full p-6'>
      <div className='bg-black border border-game-blue p-6'>
        {/* Header */}
        <div className='flex items-center justify-between mb-6'>
          <h2 className='text-xl text-game-blue flex items-center gap-2'>
            <Volume2 size={24} />
            Sound Settings
          </h2>
          <button
            onClick={handleClose}
            className='text-white/50 hover:text-white transition-colors'
            aria-label='Close settings'
          >
            <X size={24} />
          </button>
        </div>

        <div className='flex gap-8'>
          {/* Left Column - Volume Controls & Keyboard Shortcuts */}
          <div className='flex-1 min-w-[280px]'>
            {/* Main Volume Controls */}
            <div className='space-y-4 mb-8 bg-white/5 p-4 rounded-lg border border-white/10'>
              <h3 className='text-sm text-game-blue mb-4'>Volume Controls</h3>
              {Object.entries(volumes).map(([channel, value]) => (
                <VolumeSlider
                  key={channel}
                  value={value}
                  onChange={(newValue) => setVolume(channel, newValue)}
                  label={`${channel.charAt(0).toUpperCase()}${channel.slice(
                    1
                  )} Volume`}
                  channel={channel}
                />
              ))}
            </div>

            {/* Keyboard Controls Help */}
            <div className='bg-white/5 p-4 rounded-lg border border-white/10'>
              <h3 className='text-sm text-game-blue mb-3'>
                Keyboard Shortcuts
              </h3>
              <div className='grid gap-2 text-sm'>
                <div className='flex justify-between items-center text-white/80'>
                  <span>Mute/Unmute</span>
                  <kbd className='px-2 py-1 bg-black/50 rounded text-game-blue border border-game-blue/30'>
                    [M]
                  </kbd>
                </div>
                <div className='flex justify-between items-center text-white/80'>
                  <span>Toggle Settings</span>
                  <kbd className='px-2 py-1 bg-black/50 rounded text-game-blue border border-game-blue/30'>
                    [S]
                  </kbd>
                </div>
                <div className='flex justify-between items-center text-white/80'>
                  <span>Quick Volume</span>
                  <kbd className='px-2 py-1 bg-black/50 rounded text-game-blue border border-game-blue/30'>
                    [1-5]
                  </kbd>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Effect Settings */}
          <div className='flex-1 min-w-[280px] bg-white/5 p-4 rounded-lg border border-white/10'>
            <h3 className='text-sm text-game-blue mb-4'>Sound Effects</h3>
            <div className='space-y-6'>
              {Object.entries(EFFECT_GROUPS).map(([groupName, effects]) => (
                <EffectGroup
                  key={groupName}
                  groupName={groupName}
                  effects={effects}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className='mt-6 pt-4 border-t border-white/10 flex justify-between items-center'>
          <button
            onClick={resetSettings}
            className='flex items-center gap-2 text-sm text-white/50 
                   hover:text-white transition-colors group'
          >
            <RotateCcw
              size={16}
              className='group-hover:rotate-180 transition-transform duration-300'
            />
            Reset to Defaults
          </button>
          <div className='text-xs text-white/30'>
            Press [S] to toggle settings
          </div>
        </div>
      </div>
    </div>
  )
}

export default SoundSettings
