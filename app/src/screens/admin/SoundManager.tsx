import React from 'react'
import { Play, Radio, Volume2 } from 'lucide-react'
import { AUDIO_CONFIG } from '@/services/audio/AudioConfig'
import { audioService } from '@/services/audio/AudioService'
import { audioManager } from '@/services/audio/AudioManager'
import { SOUND_MAP, type SfxBucketId, type StingerPlaylistId } from '@/services/audio/SoundMap'

const getAsset = (id: string) =>
  AUDIO_CONFIG.sounds[id as keyof typeof AUDIO_CONFIG.sounds] ??
  AUDIO_CONFIG.music[id as keyof typeof AUDIO_CONFIG.music]

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className='font-mono text-[9px] uppercase tracking-widest text-muted-foreground pt-2 pb-1'>
    {children}
  </div>
)

const AssetPill: React.FC<{ id: string; mode?: 'sound' | 'music' }> = ({ id, mode = 'sound' }) => {
  const asset = getAsset(id) as { path?: string; category?: string; volume?: number; loop?: boolean } | undefined
  const play = () => {
    if (mode === 'music') {
      audioService.playMusic(id, { fadeIn: true, loop: asset?.loop })
    } else {
      audioService.playSound(id)
    }
  }

  return (
    <div className='flex items-center gap-2 border-b border-edge-subtle py-1.5 min-w-0'>
      <button
        onClick={play}
        className='w-6 h-6 border border-edge-subtle text-muted-foreground hover:text-foreground hover:border-edge-medium flex items-center justify-center shrink-0'
        title={`Play ${id}`}
      >
        <Play size={10} />
      </button>
      <div className='min-w-0 flex-1'>
        <div className='font-mono text-[10px] text-foreground truncate'>{id}</div>
        <div className='font-mono text-[9px] text-tx-dim truncate'>{asset?.path ?? 'unregistered'}</div>
      </div>
      <div className='font-mono text-[9px] text-muted-foreground shrink-0'>
        {asset?.category ?? mode}{typeof asset?.volume === 'number' ? ` · ${Math.round(asset.volume * 100)}%` : ''}
      </div>
    </div>
  )
}

const BucketRow: React.FC<{ id: SfxBucketId; sounds: string[] }> = ({ id, sounds }) => (
  <div className='border border-border p-3'>
    <div className='flex items-center justify-between gap-3 mb-2'>
      <div>
        <div className='font-mono text-[11px] text-foreground'>{id}</div>
        <div className='font-mono text-[9px] text-muted-foreground'>SFX bucket · shuffle without replacement</div>
      </div>
      <button
        onClick={() => audioManager.playFromSfxBucket(id)}
        disabled={sounds.length === 0}
        className='font-mono text-[10px] uppercase tracking-widest border border-primary/40 text-primary hover:bg-primary/15 disabled:opacity-40 px-3 py-1.5 transition-colors flex items-center gap-1.5'
      >
        <Play size={10} /> test
      </button>
    </div>
    {sounds.length === 0 ? (
      <div className='font-mono text-[10px] text-tx-dim py-1'>No sounds assigned</div>
    ) : (
      sounds.map(sound => <AssetPill key={sound} id={sound} />)
    )}
  </div>
)

const StingerRow: React.FC<{ id: StingerPlaylistId; sounds: string[] }> = ({ id, sounds }) => (
  <div className='border border-border p-3'>
    <div className='flex items-center justify-between gap-3 mb-2'>
      <div>
        <div className='font-mono text-[11px] text-foreground'>{id}</div>
        <div className='font-mono text-[9px] text-muted-foreground'>Stinger playlist · ducks music</div>
      </div>
      <button
        onClick={() => audioManager.playFromStingerPlaylist(id)}
        disabled={sounds.length === 0}
        className='font-mono text-[10px] uppercase tracking-widest border border-primary/40 text-primary hover:bg-primary/15 disabled:opacity-40 px-3 py-1.5 transition-colors flex items-center gap-1.5'
      >
        <Radio size={10} /> test
      </button>
    </div>
    {sounds.length === 0 ? (
      <div className='font-mono text-[10px] text-tx-dim py-1'>No stingers assigned</div>
    ) : (
      sounds.map(sound => <AssetPill key={sound} id={sound} />)
    )}
  </div>
)

const SoundManager: React.FC = () => {
  const sounds = Object.keys(AUDIO_CONFIG.sounds)
  const music = Object.keys(AUDIO_CONFIG.music)

  return (
    <div className='p-6 space-y-5 font-mono text-xs'>
      <div className='border border-border p-3 flex items-start gap-3'>
        <Volume2 size={14} className='text-primary mt-0.5 shrink-0' />
        <div>
          <div className='text-foreground text-[11px] uppercase tracking-widest'>Sound Management</div>
          <div className='text-muted-foreground text-[10px] mt-1 leading-relaxed'>
            This is a runtime map inspector/test bench. It shows the static bucket/playlist wiring from SoundMap.ts and registered assets from AudioConfig.ts. Editing mappings still happens in code.
          </div>
        </div>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-2 gap-4'>
        <div>
          <SectionLabel>SFX Buckets</SectionLabel>
          <div className='space-y-3'>
            {(Object.entries(SOUND_MAP.sfxBuckets) as Array<[SfxBucketId, string[]]>).map(([id, bucket]) => (
              <BucketRow key={id} id={id} sounds={bucket} />
            ))}
          </div>
        </div>

        <div>
          <SectionLabel>Stinger Playlists</SectionLabel>
          <div className='space-y-3'>
            {(Object.entries(SOUND_MAP.stingerPlaylists) as Array<[StingerPlaylistId, string[]]>).map(([id, playlist]) => (
              <StingerRow key={id} id={id} sounds={playlist} />
            ))}
          </div>

          <SectionLabel>Stinger Duck</SectionLabel>
          <div className='border border-border p-3 grid grid-cols-4 gap-2'>
            {Object.entries(SOUND_MAP.stingerDuck).map(([key, value]) => (
              <div key={key}>
                <div className='text-[9px] text-muted-foreground uppercase tracking-widest'>{key}</div>
                <div className='text-[11px] text-foreground mt-1'>{value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-2 gap-4'>
        <div>
          <SectionLabel>Level Band Music</SectionLabel>
          <div className='border border-border'>
            {SOUND_MAP.levelBands.map((band, index) => (
              <div key={`${band.from}-${band.to}-${index}`} className='p-3 border-b border-edge-subtle last:border-0'>
                <div className='font-mono text-[10px] text-muted-foreground mb-2'>Levels {band.from}–{band.to}</div>
                {band.playlist.map(track => <AssetPill key={track} id={track} mode='music' />)}
              </div>
            ))}
          </div>
        </div>

        <div>
          <SectionLabel>Registered Assets</SectionLabel>
          <div className='border border-border p-3 max-h-[420px] overflow-y-auto'>
            <div className='font-mono text-[10px] text-muted-foreground mb-2'>Sounds · {sounds.length}</div>
            {sounds.map(id => <AssetPill key={id} id={id} />)}
            <div className='font-mono text-[10px] text-muted-foreground mt-4 mb-2'>Music · {music.length}</div>
            {music.map(id => <AssetPill key={id} id={id} mode='music' />)}
          </div>
        </div>
      </div>
    </div>
  )
}

export default SoundManager
