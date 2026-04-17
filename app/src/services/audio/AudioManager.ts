// src/services/audio/AudioManager.ts
// ─────────────────────────────────────────────────────────────────
// Owns all music/stinger transitions. Subscribes to Zustand stores
// directly — no React effects, so StrictMode double-invocation
// is never an issue. Call audioManager.init() once after the first
// user interaction unlocks the AudioContext.
// ─────────────────────────────────────────────────────────────────

import { audioService } from './AudioService'
import { SOUND_MAP } from './SoundMap'
import { useStateMachine } from '@/stores/stateMachine'
import { useLevelStore } from '@/stores/levelStore'
import { MachineState } from '@/types/machine'

class AudioManager {
  private initialized = false
  private currentTrackId: string | null = null
  private unsubscribers: Array<() => void> = []

  // ── Public API ──────────────────────────────────────────────────

  /** Call once after audio is initialized (first user interaction). */
  start() {
    if (this.initialized) return
    this.initialized = true

    // Subscribe to game state — compare currentState to avoid spurious fires
    this.unsubscribers.push(
      useStateMachine.subscribe((state, prev) => {
        if (state.currentState !== prev.currentState) {
          this.handleStateChange(state.currentState)
        }
      })
    )

    // Subscribe to level — only fire when level actually increments
    this.unsubscribers.push(
      useLevelStore.subscribe((state, prev) => {
        if (state.level > prev.level) this.handleLevelAdvance(state.level)
      })
    )

    // Attempt music for the current state right away (may be blocked by autoplay policy)
    this.handleStateChange(useStateMachine.getState().currentState)

    // Retry on first user interaction in case autoplay was blocked
    const unlock = () => {
      if (!this.currentTrackId) {
        this.handleStateChange(useStateMachine.getState().currentState)
      }
      document.removeEventListener('click', unlock, true)
      document.removeEventListener('keydown', unlock, true)
    }
    document.addEventListener('click', unlock, true)
    document.addEventListener('keydown', unlock, true)
  }

  stop() {
    this.unsubscribers.forEach((fn) => fn())
    this.unsubscribers = []
    this.initialized = false
    this.currentTrackId = null
  }

  // ── Private ─────────────────────────────────────────────────────

  private async playTrack(id: string) {
    if (this.currentTrackId === id) return   // already playing — no-op
    this.currentTrackId = id
    await audioService.playMusic(id, { fadeIn: true })
  }

  private handleStateChange(state: MachineState) {
    const cfg = SOUND_MAP.screens[state]
    if (!cfg) return

    // One-shot entry sound
    if (cfg.enter) audioService.playSound(cfg.enter)

    // Music change (null means keep whatever is already playing)
    if (cfg.music) this.playTrack(cfg.music)
  }

  private handleLevelAdvance(level: number) {
    // Fire a random stinger
    const pool = SOUND_MAP.levelAdvanceStingers
    if (pool.length > 0) {
      const id = pool[Math.floor(Math.random() * pool.length)]
      audioService.playSound(id)
    }

    // Switch music if the new level crosses into a different band
    const band = [...SOUND_MAP.levelBands]
      .reverse()
      .find((b) => level >= b.from && level <= b.to)
    if (band && band.music !== this.currentTrackId) {
      this.playTrack(band.music)
    }
  }
}

export const audioManager = new AudioManager()
