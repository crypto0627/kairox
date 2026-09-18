"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { Color, Object3D, type InstancedMesh } from "three";
import { mulberry32 } from "@/lib/three/random";
import { cityWindowTexture, nightSkyTexture } from "@/lib/three/textures";

interface LayerSpec {
  count: number;
  minHeight: number;
  maxHeight: number;
  /** Vertical tiling of the window sheet, so rows stay roughly square. */
  rows: number;
  seed: number;
}

/**
 * Height classes rather than one pool. A single InstancedMesh shares one set
 * of UVs, so a 10-unit tower and a 50-unit one would stretch the same window
 * sheet by 5×; splitting by height keeps that within a believable range.
 */
const LAYERS: LayerSpec[] = [
  { count: 96, minHeight: 15, maxHeight: 34, rows: 0.8, seed: 0x5eed01 },
  { count: 62, minHeight: 34, maxHeight: 58, rows: 1.5, seed: 0x5eed02 },
  { count: 34, minHeight: 58, maxHeight: 96, rows: 2.4, seed: 0x5eed03 },
];

/**
 * The skyline starts well beyond the glass. Closer than this and a tower
 * reads as furniture standing in the room rather than as a city — the first
 * pass put them 15 units out and they swallowed the whole frame.
 */
const NEAR_Z = -78;
const FAR_Z = -235;
/** Half-width of the band, widened with depth to keep the frame filled. */
const SPAN_NEAR = 74;
const SPAN_FAR = 185;

function BuildingLayer({ count, minHeight, maxHeight, rows, seed }: LayerSpec) {
  const mesh = useRef<InstancedMesh>(null);

  const texture = useMemo(() => {
    const t = cityWindowTexture().clone();
    t.repeat.set(1, rows);
    t.needsUpdate = true;
    return t;
  }, [rows]);

  useLayoutEffect(() => {
    const target = mesh.current;
    if (!target) return;

    const random = mulberry32(seed);
    const dummy = new Object3D();
    const tint = new Color();

    for (let i = 0; i < count; i++) {
      const height = minHeight + random() * (maxHeight - minHeight);
      const depth = random();
      const z = NEAR_Z + depth * (FAR_Z - NEAR_Z);
      dummy.position.set(
        (random() * 2 - 1) * (SPAN_NEAR + depth * (SPAN_FAR - SPAN_NEAR)),
        height / 2,
        z,
      );
      const footprint = 7 + random() * 11;
      dummy.scale.set(footprint, height, 7 + random() * 11);
      dummy.rotation.set(0, (random() - 0.5) * 0.5, 0);
      dummy.updateMatrix();
      target.setMatrixAt(i, dummy.matrix);

      // Cool blocks toward the back, warmer nearer: the tint sells depth that
      // fog alone flattens out.
      tint.setHSL(0.55 + random() * 0.12, 0.35, 0.5 + random() * 0.4);
      target.setColorAt(i, tint);
    }

    target.instanceMatrix.needsUpdate = true;
    if (target.instanceColor) target.instanceColor.needsUpdate = true;
  }, [count, minHeight, maxHeight, seed]);

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </instancedMesh>
  );
}

/** The night city beyond the window: backdrop, ground haze and the towers. */
export function CityScape() {
  const sky = useMemo(() => nightSkyTexture(), []);

  return (
    <group>
      {/* Backdrop, outside the fog so the horizon glow survives the distance. */}
      <mesh position={[0, 60, -270]}>
        <planeGeometry args={[760, 260]} />
        <meshBasicMaterial map={sky} fog={false} toneMapped={false} depthWrite={false} />
      </mesh>

      {/* Ground for the towers to stand on, just under the room floor. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.08, -140]}>
        <planeGeometry args={[800, 520]} />
        <meshBasicMaterial color="#05070e" toneMapped={false} />
      </mesh>

      {LAYERS.map((layer) => (
        <BuildingLayer key={layer.seed} {...layer} />
      ))}
    </group>
  );
}
