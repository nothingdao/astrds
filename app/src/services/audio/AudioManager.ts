// src/services/audio/AudioManager.ts
// ─────────────────────────────────────────────────────────────────
// Owns all music/stinger transitions. Subscribes to Zustand stores
// directly — no React effects, so StrictMode double-invocation
// is never an issue. Call audioManager.start() once after audio initializes.
// ─────────────────────────────────────────────────────────────────

import { audioService } from "./AudioService";
import {
  SOUND_MAP,
  type SfxBucketId,
  type StingerPlaylistId,
  type LevelBand,
} from "./SoundMap";
import { useStateMachine } from "@/stores/stateMachine";
import { useLevelStore } from "@/stores/levelStore";
import { MachineState } from "@/types/machine";

type ShuffleState = {
  order: string[];
  index: number;
};

const shuffle = <T>(items: T[]): T[] => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

class AudioManager {
  private initialized = false;
  private currentTrackId: string | null = null;
  private currentLevelBand: LevelBand | null = null;
  private currentPlaylistState: ShuffleState | null = null;
  private unsubscribers: Array<() => void> = [];
  private sfxBucketStates = new Map<SfxBucketId, ShuffleState>();
  private stingerPlaylistStates = new Map<StingerPlaylistId, ShuffleState>();
  private pauseDucked = false;
  private stingersPlaying = 0;
  private stingerRestoreTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Public API ──────────────────────────────────────────────────

  /** Call once after audio is initialized (first user interaction). */
  start() {
    if (this.initialized) return;
    this.initialized = true;

    this.unsubscribers.push(
      audioService.on("musicEnded", ({ trackId }) =>
        this.handleMusicEnded(trackId)
      )
    );

    // Subscribe to game state — compare currentState to avoid spurious fires
    this.unsubscribers.push(
      useStateMachine.subscribe((state, prev) => {
        if (state.currentState !== prev.currentState) {
          this.handleStateChange(state.currentState);
        }
      })
    );

    // Subscribe to level — only fire when level actually increments
    this.unsubscribers.push(
      useLevelStore.subscribe((state, prev) => {
        if (state.level > prev.level) this.handleLevelAdvance(state.level);
      })
    );

    this.handleStateChange(useStateMachine.getState().currentState);

    const unlock = () => {
      if (!this.currentTrackId) {
        this.handleStateChange(useStateMachine.getState().currentState);
      }
      document.removeEventListener("click", unlock, true);
      document.removeEventListener("keydown", unlock, true);
    };
    document.addEventListener("click", unlock, true);
    document.addEventListener("keydown", unlock, true);
  }

  stop() {
    this.unsubscribers.forEach((fn) => fn());
    this.unsubscribers = [];
    this.initialized = false;
    this.currentTrackId = null;
    this.currentLevelBand = null;
    this.currentPlaylistState = null;
    this.sfxBucketStates.clear();
    this.stingerPlaylistStates.clear();
    this.pauseDucked = false;
    this.stingersPlaying = 0;
    if (this.stingerRestoreTimer) clearTimeout(this.stingerRestoreTimer);
    this.stingerRestoreTimer = null;
  }

  playFromSfxBucket(bucketId: SfxBucketId) {
    const id = this.nextFromBucket(
      bucketId,
      SOUND_MAP.sfxBuckets[bucketId],
      this.sfxBucketStates
    );
    if (id) audioService.playSound(id);
  }

  async playFromStingerPlaylist(playlistId: StingerPlaylistId) {
    const id = this.nextFromBucket(
      playlistId,
      SOUND_MAP.stingerPlaylists[playlistId],
      this.stingerPlaylistStates
    );
    if (!id) return;

    if (this.stingerRestoreTimer) {
      clearTimeout(this.stingerRestoreTimer);
      this.stingerRestoreTimer = null;
    }

    this.stingersPlaying++;
    await audioService.duckMusic(
      SOUND_MAP.stingerDuck.targetVolume,
      SOUND_MAP.stingerDuck.duckMs
    );
    const audio = await audioService.playSound(id);
    if (!audio) {
      this.stingersPlaying = Math.max(0, this.stingersPlaying - 1);
      this.restoreAfterStingersIfNeeded();
      return;
    }

    audio.addEventListener(
      "ended",
      () => {
        this.stingersPlaying = Math.max(0, this.stingersPlaying - 1);
        this.restoreAfterStingersIfNeeded();
      },
      { once: true }
    );
  }

  // ── Private ─────────────────────────────────────────────────────

  private nextFromBucket<K extends string>(
    key: K,
    ids: string[] | undefined,
    states: Map<K, ShuffleState>
  ): string | null {
    if (!ids || ids.length === 0) return null;
    if (ids.length === 1) return ids[0];

    let state = states.get(key);
    if (!state || state.index >= state.order.length) {
      state = { order: shuffle(ids), index: 0 };
      states.set(key, state);
    }

    const id = state.order[state.index];
    state.index++;
    return id;
  }

  private async playTrack(id: string, options: { loop?: boolean } = {}) {
    if (this.currentTrackId === id) return;
    this.currentTrackId = id;
    await audioService.playMusic(id, { fadeIn: true, loop: options.loop });
  }

  private handleStateChange(state: MachineState) {
    const cfg = SOUND_MAP.screens[state];
    if (!cfg) return;

    if (state === MachineState.PAUSED) {
      this.pauseDucked = true;
      audioService.duckMusic(
        SOUND_MAP.stingerDuck.targetVolume,
        SOUND_MAP.stingerDuck.duckMs
      );
    } else if (this.pauseDucked) {
      this.pauseDucked = false;
      if (this.stingersPlaying === 0)
        audioService.restoreMusic(SOUND_MAP.stingerDuck.restoreMs);
    }

    // One-shot entry sound
    if (cfg.enter) audioService.playSound(cfg.enter);

    if (state === MachineState.PLAYING) {
      this.playLevelBand(useLevelStore.getState().level);
      return;
    }

    // Music change (null means keep whatever is already playing)
    if (cfg.music) {
      this.currentLevelBand = null;
      this.currentPlaylistState = null;
      this.playTrack(cfg.music);
    }
  }

  private handleLevelAdvance(level: number) {
    this.playFromStingerPlaylist("levelAdvance");
    this.playLevelBand(level);
  }

  private playLevelBand(level: number) {
    const band = SOUND_MAP.levelBands.find(
      (b) => level >= b.from && level <= b.to
    );
    if (!band || band.playlist.length === 0) return;

    const sameBand = this.currentLevelBand === band;
    if (!sameBand) {
      this.currentLevelBand = band;
      this.currentPlaylistState = {
        order:
          band.playlist.length === 1
            ? [...band.playlist]
            : shuffle(band.playlist),
        index: 0,
      };
    }

    if (!this.currentPlaylistState) return;
    const trackId =
      this.currentPlaylistState.order[this.currentPlaylistState.index] ??
      band.playlist[0];
    this.currentPlaylistState.index++;
    this.playTrack(trackId, { loop: band.playlist.length === 1 });
  }

  private handleMusicEnded(trackId: string) {
    if (trackId !== this.currentTrackId || !this.currentLevelBand) return;
    const band = this.currentLevelBand;
    if (band.playlist.length <= 1) return;

    if (
      !this.currentPlaylistState ||
      this.currentPlaylistState.index >= this.currentPlaylistState.order.length
    ) {
      this.currentPlaylistState = { order: shuffle(band.playlist), index: 0 };
    }

    const next =
      this.currentPlaylistState.order[this.currentPlaylistState.index];
    this.currentPlaylistState.index++;
    this.currentTrackId = null;
    this.playTrack(next, { loop: false });
  }

  private restoreAfterStingersIfNeeded() {
    if (this.stingersPlaying > 0 || this.pauseDucked) return;
    const restore = () =>
      audioService.restoreMusic(SOUND_MAP.stingerDuck.restoreMs);
    if (SOUND_MAP.stingerDuck.holdMs > 0) {
      this.stingerRestoreTimer = setTimeout(
        restore,
        SOUND_MAP.stingerDuck.holdMs
      );
    } else {
      restore();
    }
  }
}

export const audioManager = new AudioManager();
