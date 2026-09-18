# KAIROX — Night City Trading Floor

A 3D cyberpunk trading dashboard. Five live markets on a holographic screen
array, five AI-agent robot traders at the desks below, and a transparent
glassmorphic sidebar over the whole scene.

Built with Next.js 16 (App Router), React Three Fiber v9, Tailwind CSS v4 and
Apache ECharts 6.

## Status — Phases 1 to 4 complete

| Phase | State |
| --- | --- |
| 1 — Shell, sidebar, music toggle, persistent canvas | done |
| 2 — Data layer: Binance WS, Finnhub adapter, 5s throttle, store | done |
| 3 — ECharts → CanvasTexture on the holo panels | done |
| 4 — The room: window wall, rain, city skyline | done |
| 5 — Mixamo GLTF robots, lighting rig, post-processing | not started |
| 6 — Polish, error boundaries, fallbacks | not started |

What runs today: the shell with all four routes, the glass sidebar, the
always-on-top music toggle, a five-screen holo array carrying live ECharts
candlesticks, five procedural robot workstations below it, a compact DOM
ticker tape along the bottom, and the room they all sit in — grid floor,
glazed window wall, rain, and a night skyline beyond it.

The panels plot a rolling 40-bar window of one-minute candles. BTC's window
is back-filled from Binance's REST klines, so it is full a second after the
page opens; the simulated symbols generate their own back-history, which is
consistent rather than invented — they are already labelled `SIMULATED` in
amber. A live Finnhub feed has no history source on the free tier, so those
panels build from ticks and say so: `AWAITING FIRST TICK`, then
`BUILDING FIRST BARS`.

## Getting started

```bash
pnpm install
cp .env.local.example .env.local   # optional — see below
pnpm dev
```

Open http://localhost:3000.

### Market data

- **BTC** streams from Binance's public combined WebSocket. No key, works
  immediately.
- **GOLD / QQQ / S&P 500 / PHLX** use Finnhub. Put a free key in `.env.local`
  as `FINNHUB_API_KEY`. The key is read server-side only, by
  `app/api/finnhub/token/route.ts`, which refuses to mint a socket URL for
  any symbol outside the app's allowlist.
- Without a key, or outside US cash hours, those four fall back to a
  simulated random walk and the HUD labels them `SIMULATED` in amber. The
  feature is never silently faked.

Indices are tracked through liquid ETF proxies (`SPY`, `SOXX`, `GLD`) because
Finnhub's free tier does not stream index symbols. Each panel shows a small
`via SPY` note rather than hiding the substitution.

Nothing is persisted. The back-fill is re-fetched on every load, and the
rolling window lives in memory — no database, no cache, close the tab and the
data is gone.

### Background music

Ships with **"Synthwave House Loop" by Fupi** (CC0 1.0, public domain) — a
20-bar loop at 95 BPM, encoded to Opus/WebM 96k and MP3 128k, 1.44 MB for
both. Registered in `ASSETS.md`; see `public/audio/README.md` to swap it.

The files are gitignored, so a fresh clone has no sound until you re-run the
two ffmpeg commands in `ASSETS.md`. The app runs fine either way — the
toggle detects the missing file and disables itself.

Audio never autoplays: browsers block it until the user interacts. The app
starts silent, the button pulses as an invitation, and the first click
anywhere on the page starts the track unless the user muted it before.

## Architecture notes

- **The canvas lives in the layout, not a page.** `app/(shell)/layout.tsx`
  mounts `SceneCanvas` and `AudioProvider`, so navigating between routes
  swaps only `{children}`. The WebGL context, scene graph, sockets and audio
  element all survive.
- **A price tick never re-renders the 3D tree.** The throttle flushes into
  zustand once every 5 s; `Scene` reads it through a ref inside `useFrame`,
  and only the DOM HUD subscribes reactively.
- **Providers hide behind one interface.** `lib/market/provider.ts` defines
  it; Binance, Finnhub and the simulator all implement it, so swapping a data
  source touches one file.
- **A holo panel is two canvases.** ECharts owns every pixel of the canvas it
  renders into, so anything drawn on top would be wiped on its next pass.
  `lib/chart/holoChart.ts` keeps the plot on an off-screen ECharts canvas and
  composites it, plus the hand-drawn chrome, onto a second canvas that Three
  uses as a `CanvasTexture`. The texture is flagged dirty from ECharts'
  `rendered` event, so uploads happen once per 5 s flush, not once per frame.
- **ECharts creates its canvas on the first `setOption`, not on `init`** — at
  least on a detached container. Resolving it once up front captures `null`
  forever, which is why `holoChart` looks it up lazily.
- **The city is three InstancedMeshes, not one.** A single instanced mesh
  shares one set of UVs, so a 15-unit block and a 90-unit tower would stretch
  the same window sheet by 6×. Splitting into height classes keeps the window
  rows roughly square for a few hundred buildings across three draw calls.
- **Fog is tuned for the skyline, not the room.** `fogExp2` squares with
  distance, so any density thick enough to haze a 20-unit room erases a
  200-unit city. The room takes its atmosphere from the neon instead.
- **`RobotTrader` is a placeholder behind a stable prop shape.** Phase 5
  replaces the procedural body with a Mixamo GLTF (`useGLTF` +
  `SkeletonUtils.clone()` + `useAnimations`) without touching `Workstation`.

## Scripts

```bash
pnpm dev        # dev server
pnpm build      # production build
pnpm typecheck  # tsc --noEmit
pnpm lint       # eslint
```

## Licences

3D and audio assets are registered in `ASSETS.md`. Nothing with an unclear
licence ships.
