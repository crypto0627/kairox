# KAIROX — Night City Trading Floor

A 3D cyberpunk trading dashboard. Five live markets on a holographic screen
array, five AI-agent robot traders at the desks below, and a transparent
glassmorphic sidebar over the whole scene.

Built with Next.js 16 (App Router), React Three Fiber v9, Tailwind CSS v4 and
Apache ECharts 6.

## Status — Phases 1 to 5 complete

| Phase | State |
| --- | --- |
| 1 — Shell, sidebar, music toggle, persistent canvas | done |
| 2 — Data layer: Binance WS, Finnhub adapter, 5s throttle, store | done |
| 3 — ECharts → CanvasTexture on the holo panels | done |
| 4 — The room: window wall, rain, city skyline | done |
| 5 — GLTF robots, lighting rig, post-processing | done |
| 6 — Polish, error boundaries, fallbacks | not started |

What runs today: the shell with all four routes, the glass sidebar, the
always-on-top music toggle, a five-screen holo array carrying live ECharts
candlesticks, five GLTF robot traders at standing consoles beneath it, a
compact DOM ticker tape along the bottom, and the room they work in — grid
floor, structural columns, server racks, conduit, wet-floor neon and a
glazed window wall onto a signed, advertised, rain-swept skyline.

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

### The agent floor

Each robot owns one instrument and reports on it when asked. Click a trader
and press ANALYSE NOW: its window of bars goes to a model, which answers with
a stance, a confidence, a headline and the one thing that would break the
call. The verdict drives the trader's visor colour and a reaction gesture from
the rig's own clip set, and lands in Postgres so the call can be graded later
against what the price actually did.

Nothing analyses on a timer. A model left running unattended spends either ten
seconds of a laptop or real money per call, and an idle floor does not need
telling every five minutes that four simulated feeds have no clear trend. The
only scheduled work is grading calls that have come due, which costs one REST
quote per instrument.

The model is not asked to find the trend in forty raw closes — an 8B model
reads a clean 3% climb as "no clear direction" and hedges. The window's
features are computed exactly in TypeScript (change, typical bar move, how far
the close held toward the move, how many bars agreed) and the model is asked
only for the judgment. Trend strength is measured against √n, what a random
walk of the same length drifts anyway, so the noise threshold is a statistic
rather than a guess.

Providers sit behind one interface, the same shape the market layer uses.
`ollama` runs a local model and is the default; `claude` swaps in by setting
`AGENT_PROVIDER` and a key, and shares the prompt, the output schema and the
normalisation with it. The schema is one raw JSON Schema object rather than a
zod model on one side and a literal on the other, because two definitions
drift and the whole reason to develop against a local model is being able to
compare the two on identical input.

The local model is the default deliberately: forgetting to set a variable
should not be the thing that starts a bill.

```bash
brew install ollama && brew services start ollama
ollama pull llama3.1:8b
pnpm db:up && pnpm db:push
```

Every call is graded twenty minutes later against a 0.15% dead band, from
prices the server fetches itself — a judgment gets marked whether or not
anyone had the tab open when it came due. `/history` is the scoreboard.

Three rules the layer is built around:

- **A verdict records the feed it was made on.** A call against the simulated
  walk cannot be scored against one made on a live feed, and the accuracy
  query excludes it rather than quietly inflating the number. The agent is
  told when its data is synthetic and says so in its headline.
- **Repeat calls inside a cooldown window are coalesced server-side.** A
  StrictMode double-mount put nine rows in the log for five instruments; two
  tabs would do the same. The client guards itself as well, but the client is
  not what can be trusted with the bill.
- **A directional call the market never answered is unresolved, not wrong.**
  Inside the dead band nothing was proven either way, so those rows are
  counted separately and kept out of the accuracy denominator; otherwise the
  number measures volatility rather than judgment. An agent with nothing
  resolved shows a dash, never a zero.

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
- **The traders face away from the camera.** Their consoles sit at negative
  z, which puts the desk and monitors *behind* the body rather than between
  it and the camera. Facing the other way, every robot was a visor floating
  over a black slab — the screens ate them.
- **Only the face glows.** The rig ships three materials; "Black" is a small
  plate on the head and is the one that carries the instrument's colour.
  Lighting the body panels instead turned each robot into a featureless lamp
  the moment Bloom got hold of it.
- **Bloom is not decoration here.** Night City's look is neon *bleeding* into
  fog and rain, so every emissive surface is authored `toneMapped={false}`
  and the post chain is what spends them. Without that pass the room reads as
  flat coloured tape.
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
