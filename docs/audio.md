# AUDIO SYSTEM

## Architecture

Five files, clear responsibilities:

```
AudioTypes.ts     — string ID constants (names of tracks, sounds, channels)
AudioConfig.ts    — maps IDs → file paths, volume, loop, fade config
SoundMap.ts       — maps game events/states → what plays (edit this to change behavior)
AudioService.ts   — loads HTMLAudioElements, executes play/stop/fade
AudioManager.ts   — the only brain; subscribes to game state + level, drives AudioService
```

**The one rule:** Only `AudioManager` controls music. SFX and stingers should be fired through `audioManager.playFromSfxBucket()` or `audioManager.playFromStingerPlaylist()` when they belong to a mapped game event. `audioService.playSound()` is still useful for direct one-off asset tests and legacy simple effects.

---

## Asset Storage

**Development:** drop files into `public/sounds/`. Referenced as `/sounds/filename.ext`.

**Production options:**

| Option | Egress cost | CDN | Range requests | Setup |
|---|---|---|---|---|
| Cloudflare R2 | Free | Yes | Yes | New service |
| Convex Storage | Pay per GB | No | Unknown | Already in stack |
| Vercel public/ | Pay per GB | Yes | Yes | Already in stack |

**Recommendation:** R2 for music, `public/sounds/` for SFX.

- Music files (3–8MB each) get requested by every concurrent player on every session. Egress adds up fast. R2's zero egress cost wins at scale.
- Browsers need HTTP range requests to seek/stream audio. R2 supports this natively. Convex storage is designed for user-uploaded content (avatars, etc.), not media streaming — range request support is not guaranteed.
- Convex is a good option for SFX if you want everything in one place, but for music that needs to stream reliably to many players, use a proper CDN.
- A `public/sounds/` file over ~500KB should move to R2.

To reference an external file, set its path in `AudioConfig.ts` to the full URL:
```ts
'gameMusic-intense-1': {
  path: 'https://audio.astrds.io/music/intense-1.mp3',
  volume: 0.4,
  loop: false,
  fadeInDuration: 1000,
}
```

---

## Adding a Sound or Music Track

1. Add an ID constant to `AudioTypes.ts`
2. Register it in `AudioConfig.ts` with path, volume, loop, fadeInDuration
3. Wire it in `SoundMap.ts` — either to a state, a bucket, or a level band playlist

That's it. AudioManager and AudioService pick it up automatically.

---

## Event Triggers — Full List

Every point in the game where audio can or should fire. Most system plumbing is now implemented; the main remaining work is expanding the asset library so buckets/playlists have enough variants to feel non-repeating.

### State Transitions (music + entry sound)
| State | Music | Entry Sound |
|---|---|---|
| INITIAL (title) | titleMusic playlist | — |
| READY_TO_PLAY | readyMusic | coin insert |
| PLAYING | level band playlist | — |
| PAUSED | duck music to ~30%, hold until unpaused | pause click |
| GAME_OVER | gameOverMusic | game over sting |

### Gameplay Events (SFX / stingers from buckets)
| Event | Trigger Point | Bucket / Sound | Status |
|---|---|---|---|
| Asteroid destroyed — large | collision detection | `asteroidDestroyLarge` | wired — currently placeholder/reused asset |
| Asteroid destroyed — medium | collision detection | `asteroidDestroyMedium` | wired — currently placeholder/reused asset |
| Asteroid destroyed — small | collision detection | `asteroidDestroySmall` | wired — currently placeholder/reused asset |
| Bullet fired | Ship.shootBullet | `shoot` (single) | wired |
| Ship thrust | Ship.render loop | `thrust` (loop) | wired |
| Ship destroyed | Ship.destroy | `explosion` (single) | wired |
| Pill (powerup) collected | checkCollisions | `collect` (single) | wired |
| ASTRDS token collected | checkCollisions | `collect` (single) | wired — same as pill, split if desired |
| Space token collected | checkCollisions | `spaceTokenCollect` bucket | wired — needs more variants |
| Ship pickup collected | checkCollisions | `collect` (single) | wired — same as pill, split if desired |
| Level advance stinger | levelStore | `stingerPlaylists.levelAdvance` | wired (JOI clips, stingers channel, music ducking) |
| Game over | levelStore | `gameOver` (single) | wired |
| New personal best | game over screen | `personalBest` bucket / stinger playlist | wired — needs dedicated assets |
| Leaderboard rank #1 | game over screen | `newTopScore` bucket / stinger playlist | wired — needs dedicated assets |
| Combo / asteroid streak | collision detection | `streak` stinger playlist | not wired — see Streak Definition below |

**Note on asteroid size variants:** the engine currently sees all asteroids as one type. Size will need to be passed through to the collision handler to select the right bucket. Plan for this when wiring asteroid SFX.

### UI / Meta Events
| Event | Trigger Point | Notes |
|---|---|---|
| Countdown pings (3,2,1) | ReadyScreen | already wired |
| Wallet connected | wallet adapter | not wired |
| Quarter payment confirmed | ReadyScreen | already wired (coin) |
| Space deposit sent | SendToSpaceOverlay | not wired |
| Space token claim success | SpaceTokenClaim | not wired |
| Chat message received | chat store | not wired |
| Button click / UI interaction | component level | optional, low priority |

---

## SFX Buckets

SFX buckets are pools of interchangeable sound variants. When triggered, one is picked at random using shuffle-without-replacement (no repeats until pool exhausted, then re-shuffle). **SFX do not duck music.**

Define in `SoundMap.ts`:

```ts
sfxBuckets: {
  asteroidDestroyLarge: ['explosion-large-a', 'explosion-large-b'],
  asteroidDestroyMedium: ['explosion-med-a', 'explosion-med-b', 'explosion-med-c'],
  asteroidDestroySmall: ['explosion-small-a', 'explosion-small-b'],
  spaceTokenCollect: ['space-collect-1', 'space-collect-2'],
  personalBest: ['personal-best-1'],
  newTopScore: ['top-score-1'],
  streak: ['streak-hit-1', 'streak-hit-2'],
  // add more as you create sounds
},
```

Fire from anywhere (no ducking):
```ts
audioManager.playFromSfxBucket('asteroidDestroyLarge')
```

**Current implementation status:** SFX buckets are implemented in `SoundMap.ts` and driven by `AudioManager` with shuffle-without-replacement. Several buckets intentionally contain repeated/placeholder assets until the sound library grows.

---

## Stinger Playlists

Stingers are voice clips and dramatic audio that play **over** music on the `stingers` channel and **duck the music** while they play. Like level band music, stingers are organised into named playlists that shuffle-without-replacement — no repeats until the full playlist has rotated.

Each event that triggers stingers has its own named playlist. You can have as many stinger playlists as you want.

Define in `SoundMap.ts`:

```ts
stingerPlaylists: {
  levelAdvance: [
    'joi-lets-fly',
    'joi-whoa',
    'joi-space',
    'joi-helmet',
  ],
  streak: [
    // add streak voice clips here
  ],
  personalBest: [
    // add personal best clips here
  ],
  // add new playlists freely — one per trigger event
},
```

Fire from anywhere (with ducking):
```ts
audioManager.playFromStingerPlaylist('levelAdvance')
```

**Current implementation status:** stinger playlists are implemented and use the `stingers` volume channel. `levelAdvance` contains the current JOI clips. `streak`, `personalBest`, and `newTopScore` are reserved and wired, but need dedicated clips.

---

## Stinger Ducking

When a stinger fires, the `music` channel dips then restores. Ducking is **global** — one config applies to all stingers. No per-stinger settings.

Configure once in `SoundMap.ts`:

```ts
stingerDuck: {
  targetVolume: 0.3,   // dip to this fraction of current music volume
  duckMs: 200,         // fade-down duration in ms
  holdMs: 0,           // hold at low (0 = begin restoring as soon as stinger ends)
  restoreMs: 800,      // fade back up duration in ms
},
```

AudioManager ducks on stinger start, listens for the stinger's `ended` event, then restores. Pause ducking (PAUSED state) uses the same `duckMs`/`restoreMs` curve but holds indefinitely until the state returns to PLAYING. This is implemented in `AudioManager`/`AudioService` via `duckMusic()` and `restoreMusic()`.

---

## Level Band Playlists

The `levelBands` array in `SoundMap.ts` maps level ranges to music playlists. Bands are evaluated in order — first match wins. Define as many bands as you want.

```ts
levelBands: [
  {
    from: 1,
    to: 5,
    playlist: ['gameMusic-calm-1', 'gameMusic-calm-2'],
  },
  {
    from: 6,
    to: 12,
    playlist: ['gameMusic-mid-1', 'gameMusic-mid-2', 'gameMusic-mid-3'],
  },
  {
    from: 13,
    to: 999,
    playlist: ['gameMusic-intense-1', 'gameMusic-intense-2'],
  },
],
```

**Playlist behavior:**
- On entering a band: shuffle the playlist, start track 1
- When a track ends naturally (`ended` event): advance to next in shuffled order
- When the full rotation completes: re-shuffle and loop
- When the level crosses into a new band: re-shuffle that band's playlist and start fresh
- Single-track playlists: just loop that track

This is implemented. Current `SoundMap.ts` has a single level band with a one-track playlist; adding more tracks/bands only requires registering tracks in `AudioConfig.ts` and adding them to `SoundMap.ts`.

**To add music to a band:** register the track in `AudioConfig.ts` with `loop: false`, add the ID to the playlist array. Done.

---

## Volume Channels

Four channels, each 0–1, multiplied together to get final volume. All are exposed in sound settings:

| Channel | Controls | Key |
|---|---|---|
| `master` | everything | `m` key toggles mute |
| `music` | level band tracks, title, game over | — |
| `sfx` | gameplay sound effects (shoot, explosion, collect, thrust) | — |
| `stingers` | voice clips, dramatic stings, all ducking audio | — |

Stingers are on their own channel so they can be tuned independently from gameplay SFX and from music. Ducking operates on the `music` channel only.

---

## Streak Definition

**TBD.** The trigger point is reserved in the event table and a `streak` stinger playlist slot exists in `SoundMap.ts`. Define the threshold and mechanic when you have voice clips that feel right for the moment.

Options to consider when ready: kill streak (N asteroids without damage), time burst (N asteroids in X seconds), or score milestone (every N points).

## Admin Sound Tab

The Admin overlay includes a **Sound** tab (`src/screens/admin/SoundManager.tsx`) for inspecting the current runtime audio map.

It shows:
- SFX buckets and assigned asset IDs
- Stinger playlists and assigned asset IDs
- Global stinger duck config
- Level band music playlists
- All registered sound/music assets from `AudioConfig.ts`

Each bucket, playlist, and direct asset has a test button. Bucket/playlist tests call the real `AudioManager` APIs so shuffle behavior and stinger ducking can be tested in-app.

The tab is intentionally read-only for now. `SoundMap.ts` and `AudioConfig.ts` remain the source of truth.

---

## What Not To Do

- **Don't call `audioService.playMusic()` from components or stores.** Only AudioManager does this. If you need music to change, change the game state — AudioManager reacts.
- **Don't add audio files to the repo that are > ~500KB.** SFX only. Music goes to R2.
- **Don't hardcode file paths in components.** All paths live in `AudioConfig.ts`.
