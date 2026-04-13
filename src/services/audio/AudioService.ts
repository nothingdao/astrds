// src/services/audio/AudioService.ts
import AudioEventEmitter from './AudioEventEmitter'
import { AUDIO_CONFIG } from './AudioConfig'
import { VOLUME_CHANNELS } from './AudioTypes'

// Define event types and their corresponding callback types
type AudioEvents = {
  volumeChanged: (data: { channel: string; value: number }) => void
  initialized: () => void
  error: (error: Error) => void
  effectSettingChanged: (data: { effectType: string; setting: any }) => void
  musicStarted: (data: { trackId: string }) => void // Updated to expect an object
  musicStopped: (data: { trackId: string }) => void // Updated to expect an object
}

class AudioService {
  private config: typeof AUDIO_CONFIG
  private sounds: Map<string, { audio: HTMLAudioElement; config: any }>
  private music: Map<string, { audio: HTMLAudioElement; config: any }>
  private currentMusic: {
    id: string
    audio: HTMLAudioElement
    config: any
  } | null
  private eventEmitter: AudioEventEmitter
  private volumes: { [key: string]: number }
  private initialized: boolean
  private effectSettings: { [key: string]: any }
  private loopingSounds: Set<string>

  constructor(config: typeof AUDIO_CONFIG) {
    this.config = config
    this.sounds = new Map()
    this.music = new Map()
    this.currentMusic = null
    this.eventEmitter = new AudioEventEmitter()
    this.volumes = { ...config.defaultVolumes }
    this.initialized = false
    this.effectSettings = { ...config.effectSettings }
    this.loopingSounds = new Set()
    this.loadSettings() // Load saved settings on initialization
  }

  // Public getters for private properties
  getVolumes() {
    return this.volumes
  }

  getEffectSettings() {
    return this.effectSettings
  }

  isInitialized() {
    return this.initialized
  }

  on<K extends keyof AudioEvents>(
    event: K,
    callback: AudioEvents[K]
  ): () => void {
    return this.eventEmitter.on(event, callback)
  }

  off<K extends keyof AudioEvents>(event: K, callback: AudioEvents[K]): void {
    this.eventEmitter.off(event, callback)
  }

  async loadMusic(id: string, config: any): Promise<void> {
    const audio = new Audio(config.path)
    audio.volume = 0
    audio.loop = config.loop

    await new Promise((resolve, reject) => {
      audio.addEventListener('canplaythrough', resolve)
      audio.addEventListener('error', reject)
      audio.load()
    })

    this.music.set(id, { audio, config })
  }

  async playMusic(
    id: string,
    options: { loop?: boolean; fadeIn?: boolean } = {}
  ): Promise<void> {
    if (!this.initialized) {
      console.log('Attempted to play music before initialization:', id)
      return
    }

    const music = this.music.get(id)
    if (!music) {
      console.warn(`Music track not found: ${id}`)
      return
    }

    try {
      // Already playing this track — nothing to do
      if (this.currentMusic?.id === id) return

      // Stop previous track with fade
      if (this.currentMusic) {
        await this.stopMusic(this.currentMusic.id, { fadeOut: true })
      }

      const { audio, config } = music
      audio.volume = this.calculateVolume('music') * config.volume
      audio.loop = options.loop ?? config.loop

      if (options.fadeIn) {
        await this.fadeIn(audio, config.fadeInDuration || 1000)
      } else {
        await audio.play()
      }

      this.currentMusic = { id, audio, config }
      this.eventEmitter.emit('musicStarted', { trackId: id }) // Updated to provide data
    } catch (error) {
      console.error(`Error playing music ${id}:`, error)
      this.eventEmitter.emit('error', { type: 'playMusic', id, error }) // Updated to provide data
    }
  }

  async stopMusic(
    id: string,
    options: { fadeOut?: boolean } = {}
  ): Promise<void> {
    const music = this.music.get(id)
    if (!music) {
      console.warn(`Attempted to stop non-existent music: ${id}`)
      return
    }

    try {
      console.log(`Stopping music: ${id}`, { options })
      const { audio } = music

      if (options.fadeOut) {
        await this.fadeOut(audio)
      }

      audio.pause()
      audio.currentTime = 0

      if (this.currentMusic?.id === id) {
        this.currentMusic = null
      }

      this.eventEmitter.emit('musicStopped', { trackId: id }) // Updated to provide data
    } catch (error) {
      console.error(`Error stopping music ${id}:`, error)
      this.eventEmitter.emit('error', { type: 'stopMusic', id, error }) // Updated to provide data
    }
  }

  async transitionMusic(
    fromId: string,
    toId: string,
    options: { crossFadeDuration?: number } = {}
  ): Promise<void> {
    const fromMusic = this.music.get(fromId)
    const toMusic = this.music.get(toId)

    if (!fromMusic || !toMusic) {
      console.warn('One or both music tracks not found for transition')
      return
    }

    try {
      const duration = options.crossFadeDuration || 1000

      // Start new music at 0 volume
      toMusic.audio.volume = 0
      await toMusic.audio.play()

      // Cross-fade
      await Promise.all([
        this.fadeOut(fromMusic.audio, duration),
        this.fadeIn(toMusic.audio, duration),
      ])

      // Clean up old music
      fromMusic.audio.pause()
      fromMusic.audio.currentTime = 0

      this.currentMusic = { id: toId, ...toMusic }
      this.eventEmitter.emit('musicTransitioned', { from: fromId, to: toId }) // Updated to provide data
    } catch (error) {
      this.eventEmitter.emit('error', { type: 'transitionMusic', error }) // Updated to provide data
    }
  }

  setEffectSetting(effectType: string, setting: any): void {
    if (this.effectSettings.hasOwnProperty(effectType)) {
      this.effectSettings[effectType] = setting
      this.saveSettings()
      this.eventEmitter.emit('effectSettingChanged', { effectType, setting }) // This is already correct
    }
  }

  private saveSettings(): void {
    try {
      const settings = {
        volumes: this.volumes,
        effectSettings: this.effectSettings,
      }
      localStorage.setItem('audioSettings', JSON.stringify(settings))
    } catch (error) {
      console.error('Failed to save audio settings:', error)
    }
  }

  private loadSettings(): void {
    try {
      const saved = localStorage.getItem('audioSettings')
      if (saved) {
        const settings = JSON.parse(saved)
        this.volumes = { ...this.volumes, ...settings.volumes }
        this.effectSettings = {
          ...this.effectSettings,
          ...settings.effectSettings,
        }
      }
    } catch (error) {
      console.error('Failed to load audio settings:', error)
    }
  }

  resetSettings(): void {
    // Reset to default values from config
    this.volumes = { ...this.config.defaultVolumes }
    this.effectSettings = { ...this.config.effectSettings }

    // Update all audio volumes
    this.updateAllVolumes()

    // Save the reset settings
    this.saveSettings()

    // Emit events for UI updates
    Object.entries(this.volumes).forEach(([channel, value]) => {
      this.eventEmitter.emit('volumeChanged', { channel, value }) // This is already correct
    })

    Object.entries(this.effectSettings).forEach(([effectType, setting]) => {
      this.eventEmitter.emit('effectSettingChanged', { effectType, setting }) // This is already correct
    })

    this.eventEmitter.emit('settingsReset', {}) // Updated to provide empty data
  }

  private async fadeIn(
    audio: HTMLAudioElement,
    duration = 1000
  ): Promise<void> {
    const targetVolume = audio.volume
    audio.volume = 0
    await audio.play()

    return new Promise((resolve) => {
      const steps = duration / 50
      const volumeStep = targetVolume / steps
      let currentStep = 0

      const fadeInterval = setInterval(() => {
        currentStep++
        audio.volume = Math.min(targetVolume, volumeStep * currentStep)

        if (currentStep >= steps) {
          clearInterval(fadeInterval)
          resolve()
        }
      }, 50)
    })
  }

  private async fadeOut(
    audio: HTMLAudioElement,
    duration = 1000
  ): Promise<void> {
    const startVolume = audio.volume
    return new Promise((resolve) => {
      const steps = duration / 50
      const volumeStep = startVolume / steps
      let currentStep = 0

      const fadeInterval = setInterval(() => {
        currentStep++
        audio.volume = Math.max(0, startVolume - volumeStep * currentStep)

        if (currentStep >= steps) {
          clearInterval(fadeInterval)
          resolve()
        }
      }, 50)
    })
  }

  async init(onProgress: (progress: number) => void = () => {}): Promise<void> {
    if (this.initialized) return

    try {
      // Calculate total assets (both sounds and music)
      const totalAssets =
        Object.keys(this.config.sounds).length +
        Object.keys(this.config.music).length
      let loadedAssets = 0

      const updateProgress = () => {
        loadedAssets++
        const progress = (loadedAssets / totalAssets) * 100
        onProgress(progress)
      }

      // Load sound effects
      await Promise.all(
        Object.entries(this.config.sounds).map(([id, config]) =>
          this.loadSound(id, config).then(updateProgress)
        )
      )

      // Load music tracks
      await Promise.all(
        Object.entries(this.config.music).map(([id, config]) =>
          this.loadMusic(id, config).then(updateProgress)
        )
      )

      this.initialized = true
      console.log('Audio system initialized with:', {
        sounds: Array.from(this.sounds.keys()),
        music: Array.from(this.music.keys()),
      })
      this.eventEmitter.emit('initialized', {}) // Updated to provide empty data
    } catch (error) {
      console.error('Failed to initialize audio system:', error)
      this.eventEmitter.emit('error', error) // Updated to provide data
      throw error
    }
  }

  private async loadSound(id: string, config: any): Promise<void> {
    try {
      const audio = new Audio(config.path)
      audio.volume = 0

      await new Promise((resolve, reject) => {
        audio.addEventListener('canplaythrough', resolve)
        audio.addEventListener('error', reject)
        audio.load()
      })

      this.sounds.set(id, { audio, config })
    } catch (error) {
      console.error(`Failed to load sound: ${id}`, error)
      throw error
    }
  }

  playSoundLoop(id: string): void {
    if (this.loopingSounds.has(id)) return
    const sound = this.sounds.get(id)
    if (!sound || !this.initialized) return
    const { audio, config } = sound
    audio.loop = true
    audio.volume = this.calculateVolume(config.category) * config.volume
    audio.play().catch(() => {})
    this.loopingSounds.add(id)
  }

  stopSoundLoop(id: string): void {
    if (!this.loopingSounds.has(id)) return
    const sound = this.sounds.get(id)
    if (sound) {
      sound.audio.loop = false
      sound.audio.pause()
      sound.audio.currentTime = 0
    }
    this.loopingSounds.delete(id)
  }

  async playSound(id: string): Promise<void> {
    if (!this.initialized) {
      console.warn('Audio system not initialized')
      return
    }

    const sound = this.sounds.get(id)
    if (!sound) {
      console.warn(`Sound not found: ${id}`)
      return
    }

    try {
      const { audio, config } = sound
      audio.volume = this.calculateVolume(config.category) * config.volume

      if (audio.currentTime > 0) {
        audio.currentTime = 0
      }

      await audio.play()
      this.eventEmitter.emit('soundPlayed', { id }) // Updated to provide data
    } catch (error) {
      this.eventEmitter.emit('error', { type: 'playSound', id, error }) // Updated to provide data
    }
  }

  setVolume(channel: string, value: number): void {
    if (!Object.values(VOLUME_CHANNELS).includes(channel)) {
      console.warn(`Invalid volume channel: ${channel}`)
      return
    }

    const normalizedValue = Math.max(0, Math.min(1, value))
    this.volumes[channel] = normalizedValue

    // Update all active audio
    this.updateAllVolumes()

    this.eventEmitter.emit('volumeChanged', { channel, value: normalizedValue }) // This is already correct
  }

  private updateAllVolumes(): void {
    // Update sound effects
    this.sounds.forEach(({ audio, config }) => {
      audio.volume = this.calculateVolume(config.category) * config.volume
    })

    // Update music if playing
    if (this.currentMusic) {
      const { audio, config } = this.currentMusic // Access properties directly from currentMusic
      audio.volume = this.calculateVolume('music') * config.volume
    }
  }

  private calculateVolume(category: string): number {
    return this.volumes[VOLUME_CHANNELS.MASTER] * this.volumes[category]
  }

  destroy(): void {
    this.sounds.forEach(({ audio }) => {
      audio.pause()
      audio.src = ''
    })
    this.sounds.clear()
    this.music.clear()
    this.loopingSounds.clear()
    this.initialized = false
  }
}

// Create and export singleton instance.
// NOTE: do NOT call audioService.init() here — AudioManager owns initialization
// to avoid double-play under React StrictMode.
export const audioService = new AudioService(AUDIO_CONFIG)
