// src/hooks/useAudio.ts
import { useState, useEffect } from 'react'
import { audioService } from '../services/audio/AudioService'

export const useAudio = () => {
  const [volumes, setVolumes] = useState(audioService.getVolumes())
  const [effectSettings, setEffectSettings] = useState(
    audioService.getEffectSettings()
  )
  const [isInitialized, setIsInitialized] = useState(
    audioService.isInitialized()
  )
  const [currentMusic, setCurrentMusic] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    // Set up event listeners
    const handleVolumeChange = ({ channel, value }) => {
      setVolumes((prev) => ({ ...prev, [channel]: value }))
    }

    const handleEffectSettingChanged = ({ effectType, setting }) => {
      setEffectSettings((prev) => ({ ...prev, [effectType]: setting }))
    }

    const handleInitialized = () => {
      setIsInitialized(true)
      setError(null)
    }

    const handleError = (error) => {
      console.error('Audio error:', error)
      setError(error)
    }

    const handleMusicStarted = (data) => {
      setCurrentMusic(data.trackId)
    }

    const handleMusicStopped = () => {
      setCurrentMusic(null)
    }

    // Subscribe to audio service events
    const unsubscribe = [
      audioService.on('volumeChanged', handleVolumeChange),
      audioService.on('initialized', handleInitialized),
      audioService.on('error', handleError),
      audioService.on('effectSettingChanged', handleEffectSettingChanged),
      audioService.on('musicStarted', handleMusicStarted),
      audioService.on('musicStopped', handleMusicStopped),
    ]

    // Initialize audio service if not already initialized
    if (!audioService.isInitialized()) {
      audioService.init().catch(handleError)
    }

    // Cleanup event listeners
    return () => {
      unsubscribe.forEach((unsub) => unsub())
    }
  }, [])

  return {
    // State
    isInitialized,
    volumes,
    effectSettings,
    currentMusic,
    error,

    // Audio controls
    playSound: (soundId) => {
      try {
        return audioService.playSound(soundId)
      } catch (err) {
        setError(err)
        throw err
      }
    },
    playMusic: audioService.playMusic.bind(audioService),
    stopMusic: audioService.stopMusic.bind(audioService),
    transitionMusic: audioService.transitionMusic.bind(audioService),
    setVolume: audioService.setVolume.bind(audioService),
    setEffectSetting: audioService.setEffectSetting.bind(audioService),
    resetSettings: audioService.resetSettings.bind(audioService),

    // Utility methods
    clearError: () => setError(null),
  }
}
