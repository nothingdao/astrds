// src/components/sound/SoundSettings.tsx
import React from 'react'
import { RotateCcw, Play } from 'lucide-react'
import { useAudio } from '@/hooks/useAudio'
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
  if (!isInitialized || !isOpen) return null

  const handleTestSound = (effectType: EffectType) => {
    if (effectSettings[effectType] !== 'off') {
      playSound(effectType)
    }
  }

  const EffectGroup: React.FC<EffectGroupProps> = ({ groupName, effects }) => (
    <div key={groupName}>
      <h4 className='font-mono text-[10px] text-white/40 uppercase tracking-widest mb-3'>{groupName}</h4>
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
    <div className='p-5 space-y-5'>
      <div className='flex gap-6'>
        {/* Left Column - Volume Controls & Keyboard Shortcuts */}
        <div className='flex-1 space-y-4'>
          {/* Main Volume Controls */}
          <div className='bg-neutral-800 border border-white/10 rounded-lg p-4 space-y-4'>
            <h3 className='font-mono text-[10px] text-game-blue uppercase tracking-widest'>Volume Controls</h3>
            {Object.entries(volumes).map(([channel, value]) => (
              <VolumeSlider
                key={channel}
                value={value}
                onChange={(newValue) => setVolume(channel, newValue)}
                label={`${channel.charAt(0).toUpperCase()}${channel.slice(1)} Volume`}
                channel={channel}
              />
            ))}
          </div>

          {/* Keyboard Controls Help */}
          <div className='bg-neutral-800 border border-white/10 rounded-lg p-4'>
            <h3 className='font-mono text-[10px] text-game-blue uppercase tracking-widest mb-3'>
              Keyboard Shortcuts
            </h3>
            <div className='space-y-2'>
              {[
                { label: 'Mute/Unmute', key: '[H]' },
                { label: 'Quick Volume', key: '[1–5]' },
              ].map(({ label, key }) => (
                <div key={label} className='flex justify-between items-center'>
                  <span className='font-mono text-xs text-white/50'>{label}</span>
                  <kbd className='font-mono text-[10px] px-2 py-0.5 bg-neutral-900 text-game-blue border border-game-blue/30'>
                    {key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column - Effect Settings */}
        <div className='flex-1 bg-neutral-800 border border-white/10 rounded-lg p-4'>
          <h3 className='font-mono text-[10px] text-game-blue uppercase tracking-widest mb-4'>Sound Effects</h3>
          <div className='space-y-5'>
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
      <div className='pt-3 border-t border-white/10 flex justify-between items-center'>
        <button
          onClick={resetSettings}
          className='flex items-center gap-2 font-mono text-xs text-white/40 hover:text-white transition-colors group'
        >
          <RotateCcw
            size={13}
            className='group-hover:rotate-180 transition-transform duration-300'
          />
          Reset to Defaults
        </button>
      </div>
    </div>
  )
}

export default SoundSettings
