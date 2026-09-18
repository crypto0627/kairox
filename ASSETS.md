# Asset register

Every downloaded asset gets a row here **at download time**, not later.
Nothing with an unclear licence ships.

| File | Source | Author | Licence | Downloaded |
| --- | --- | --- | --- | --- |
| `public/audio/synthwave-house-loop.webm` + `.mp3` | [OpenGameArt — Synthwave House Loop](https://opengameart.org/content/synthwave-house-loop) | Fupi | CC0 1.0 (public domain, no attribution required) | 2026-09-18 |
| `public/models/robot-trader.glb` | [three.js examples — RobotExpressive](https://github.com/mrdoob/three.js/tree/dev/examples/models/gltf/RobotExpressive) | Tomás Laulhé (Quaternius), converted by Don McCurdy | CC0 1.0 | 2026-09-18 |

## Audio provenance

The track the original spec named — "Shuttle Departure" by Apesaw — was
**not** used: its only traceable distribution is social-media music
libraries, whose grant does not cover continuous streaming from your own
site. No verifiable web-embedding licence, so it does not ship.

The CC0 replacement above is a 20-bar loop at 95 BPM (50.526 s), which is an
exact musical cycle — no trimming was needed. Re-create the shipped files
from the CC0 WAV with:

```bash
curl -L -o src.wav https://opengameart.org/sites/default/files/synthwavehouse.wav
ffmpeg -i src.wav -vn -c:a libopus    -b:a  96k -application audio synthwave-house-loop.webm
ffmpeg -i src.wav -vn -c:a libmp3lame -b:a 128k                    synthwave-house-loop.mp3
```

Shipped size: 683 KB + 791 KB = **1.44 MB**, inside the 3 MB audio budget.

## Model provenance

Mixamo, which the original plan named, needs an Adobe sign-in, and the
Sketchfab and Quaternius packs all download through interactive flows. The
rig that ships is the three.js sample robot — CC0, rigged, and carrying a
useful clip set (Idle, Sitting, Yes, No, Wave). Re-fetch it with:

```bash
curl -L -o public/models/robot-trader.glb \
  https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/gltf/RobotExpressive/RobotExpressive.glb
```

**The optimisation pass below was not run on it, deliberately.** It arrives at
464 KB against an 8 MB budget, with no textures at all — its three materials
are flat colours, which is also why re-skinning it to the room's palette is a
three-line traverse. `gltf-transform` would have nothing to do.

Everything else in the scene — the skyline, its signage and holograms, the
room, the rain — is generated at runtime from canvas textures in
`lib/three/textures.ts`. For a stylised neon set that is the better tool: no
licence surface, nothing to download, and a few hundred bytes of code per
element instead of megabytes of mesh.

## Where assets come from

| Need | Source | Licence to look for |
| --- | --- | --- |
| Robot body + animation clips | [Mixamo](https://www.mixamo.com/) | Free with an Adobe account; usable commercially, redistribution of the raw asset is not |
| Props: server racks, sci-fi desks, chairs | [Sketchfab](https://sketchfab.com/) (filter *Downloadable* + CC) | CC0 or CC-BY (CC-BY needs a Credits entry) |
| Higher-fidelity hardware | [CGTrader](https://www.cgtrader.com/) / [TurboSquid](https://www.turbosquid.com/) | Per-model royalty-free terms |
| PBR materials | [ambientCG](https://ambientcg.com/) | CC0 |
| Night HDRI | [Poly Haven](https://polyhaven.com/hdris) | CC0 |
| One-off props | [Meshy](https://www.meshy.ai/) / [Tripo3D](https://www.tripo3d.ai/) | Check the tool's commercial-use terms |

## Optimisation pass (required before committing any model)

```bash
gltf-transform dedup  in.glb s1.glb
gltf-transform prune  s1.glb s2.glb
gltf-transform resize s2.glb s3.glb --width 1024 --height 1024
gltf-transform webp   s3.glb s4.glb --slots "*"
gltf-transform draco  s4.glb out.glb --method edgebreaker
```

A raw Mixamo robot lands at 40–60 MB and must come out at **3–5 MB**. If it
does not, decimate in Blender before re-exporting.

Budget: ≤ 8 MB models, ≤ 6 MB textures, ≤ 2 MB HDRI, ≤ 3 MB audio.
