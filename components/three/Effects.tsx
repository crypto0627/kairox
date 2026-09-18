"use client";

import { useMemo } from "react";
import { Vector2 } from "three";
import {
  Bloom,
  ChromaticAberration,
  EffectComposer,
  Noise,
  Vignette,
} from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";

/**
 * The post chain.
 *
 * Night City's look is not the neon itself, it is the neon *bleeding* — light
 * from a sign seeping into the fog and the rain around it. Every emissive
 * surface in this scene is authored with that in mind (`toneMapped={false}`
 * on the strips, the panels, the city windows), and Bloom is what actually
 * spends it. Without this pass the room reads as flat coloured tape.
 *
 * Grain and a little lens error are the Entropism half of the same brief: the
 * city is grimy, and a perfectly clean frame reads as a render.
 */
export function Effects() {
  const aberration = useMemo(() => new Vector2(0.00065, 0.00045), []);

  return (
    <EffectComposer multisampling={4}>
      <Bloom
        intensity={0.95}
        luminanceThreshold={0.33}
        luminanceSmoothing={0.45}
        mipmapBlur
        radius={0.72}
      />
      <ChromaticAberration offset={aberration} radialModulation modulationOffset={0.35} />
      <Noise opacity={0.04} blendFunction={BlendFunction.OVERLAY} />
      <Vignette offset={0.24} darkness={0.72} />
    </EffectComposer>
  );
}
