# Asset register

Every downloaded asset gets a row here **at download time**, not later.
Nothing with an unclear licence ships.

| File | Source | Author | Licence | Downloaded |
| --- | --- | --- | --- | --- |
| _(none yet)_ | | | | |

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
