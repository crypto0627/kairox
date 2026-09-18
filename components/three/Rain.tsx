"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, Object3D, type InstancedMesh } from "three";
import { mulberry32 } from "@/lib/three/random";
import { usePrefersReducedMotion } from "@/lib/three/environment";

const COUNT = 1300;
/** Drops recycle over this height; also the spawn ceiling. */
const COLUMN = 28;
const SPAN_X = 32;
const NEAR_Z = -13;
const FAR_Z = -42;
/** Wind: streaks lean, and drift sideways as they fall. */
const SLANT = 0.17;

interface Drop {
  x: number;
  z: number;
  phase: number;
  speed: number;
  length: number;
}

/**
 * Rain outside the window.
 *
 * One InstancedMesh and a per-frame matrix rewrite — 900 composes a frame is
 * nothing next to a draw call each, and it keeps the falling entirely on the
 * CPU where it stays readable. Confined to the far side of the glass: none of
 * it belongs in the room.
 */
export function Rain() {
  const mesh = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  // Nine hundred streaks falling constantly is the one element here that is
  // pure motion and carries no information. Someone who asked their system
  // for less of that should not get it.
  const stillness = usePrefersReducedMotion();

  const drops = useMemo<Drop[]>(() => {
    const random = mulberry32(0x7a12c0de);
    return Array.from({ length: COUNT }, () => ({
      x: (random() * 2 - 1) * SPAN_X,
      z: NEAR_Z + random() * (FAR_Z - NEAR_Z),
      phase: random() * COLUMN,
      speed: 10 + random() * 13,
      length: 0.45 + random() * 0.95,
    }));
  }, []);

  useFrame(({ clock }) => {
    const target = mesh.current;
    if (!target) return;
    const t = clock.elapsedTime;

    for (let i = 0; i < drops.length; i++) {
      const drop = drops[i];
      const fallen = (drop.phase + t * drop.speed) % COLUMN;
      const y = COLUMN - fallen;
      dummy.position.set(drop.x + fallen * SLANT, y, drop.z);
      dummy.rotation.set(0, 0, -SLANT);
      dummy.scale.set(1, drop.length, 1);
      dummy.updateMatrix();
      target.setMatrixAt(i, dummy.matrix);
    }
    target.instanceMatrix.needsUpdate = true;
  });

  if (stillness) return null;

  return (
    <instancedMesh
      ref={mesh}
      args={[undefined, undefined, COUNT]}
      frustumCulled={false}
    >
      <planeGeometry args={[0.018, 1]} />
      <meshBasicMaterial
        color="#8fd8ff"
        transparent
        opacity={0.42}
        blending={AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </instancedMesh>
  );
}
