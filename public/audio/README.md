# Background audio

The app ships these two files, both encoded from one CC0 source:

```
synthwave-house-loop.webm   Opus 96 kbps   683 KB
synthwave-house-loop.mp3    MP3  128 kbps  791 KB   Safari fallback
```

Track: **"Synthwave House Loop" by Fupi** — CC0 1.0, public domain, no
attribution required. Registered in `ASSETS.md`, which also carries the
source URL and the exact ffmpeg commands to re-create both files.

`AudioProvider` offers the `.webm` first and falls back to the `.mp3`, so
every current browser gets one of them.

## Why not "Shuttle Departure"

The original spec named "Shuttle Departure" by Apesaw. It was dropped: the
only traceable distribution is social-media music libraries, and that grant
does not cover a site streaming the track continuously. No verifiable
web-embedding licence, so it does not ship. See `ASSETS.md`.

## Looping

The source is an exact 20 bars at 95 BPM (50.526 s) with no leading or
trailing silence, so it loops on a bar boundary as-is — no trimming was
needed.

If you swap in a different track, keep that property: match the tail to the
head on a bar boundary, strip silence at both ends, and keep both files
under 3 MB combined. Encoding:

```bash
ffmpeg -i source.wav -vn -c:a libopus    -b:a  96k -application audio track.webm
ffmpeg -i source.wav -vn -c:a libmp3lame -b:a 128k                    track.mp3
```

Then point the provider at the new basename — one line in
`app/(shell)/layout.tsx`:

```tsx
<AudioProvider src="/audio/track">
```

`MusicToggle` detects a load error and renders a disabled button, so a
missing or misnamed file degrades quietly instead of breaking the app.

## Git

`.gitignore` excludes `/public/audio/*.mp3` and `*.webm` — the blanket rule
that kept unlicensed audio out of the repo. These two files are CC0 and safe
to commit; add an exception if you want a fresh clone to have sound without
re-downloading.
