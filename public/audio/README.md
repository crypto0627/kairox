# Background audio

The app expects two files here:

```
shuttle-departure.webm   Opus, ~96 kbps
shuttle-departure.mp3    Safari fallback, ~128 kbps
```

Track: **"Shuttle Departure" by Apesaw**.

## Before you add the file

Confirm the licence covers **web/app embedding**, not only video-on-social.
A site that streams a track continuously is a different grant from a YouTube
upload. If attribution is required, add it to `ASSETS.md` and to the Credits
panel.

If the licence does not cover this use, any CC0/CC-BY synthwave loop works —
`AudioProvider` takes the path as a prop, so swapping is a one-line change in
`app/(shell)/layout.tsx`.

## Encoding

Trim to a seamless loop (match the tail to the head on a bar boundary, no
leading or trailing silence) and keep both files under 3 MB combined.

```bash
ffmpeg -i source.wav -c:a libopus -b:a 96k  shuttle-departure.webm
ffmpeg -i source.wav -c:a libmp3lame -b:a 128k shuttle-departure.mp3
```

Until the files exist, `MusicToggle` detects the load error and renders a
disabled button — the app runs fine without them.
