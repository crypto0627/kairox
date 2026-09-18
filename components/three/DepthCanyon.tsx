"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, Object3D, type InstancedMesh } from "three";
import { currentBook, useDepthFeed } from "@/lib/market/depthFeed";
import { step } from "@/lib/three/environment";

const LEVELS = 20;
/** Spacing between price levels along x. */
const STEP = 0.34;
const WIDTH = 0.28;
const DEPTH = 1.5;
const MAX_HEIGHT = 3.1;
/** How fast a wall grows or collapses toward the book. */
const EASE = 7;

const BID = new Color("#00e5b0");
const ASK = new Color("#ff2e88");

/**
 * The order book as terrain.
 *
 * Price runs along x with the mid at the centre, cumulative size is height,
 * so resting liquidity is literally a wall and the spread is the gap you are
 * standing in. A 2D ladder can show the same numbers; it cannot show you a
 * wall appearing three levels out and then vanishing, which is the thing
 * worth having a room for.
 *
 * Heights are normalised to the deepest level in the current book, so the
 * shape is always legible — the absolute size is printed on the readout
 * instead, because a relative axis that does not say so is a lie.
 */
export function DepthCanyon() {
  useDepthFeed("btcusdt");

  const bids = useRef<InstancedMesh>(null);
  const asks = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  /** Eased heights, so the walls move rather than snap ten times a second. */
  const shown = useRef({ bid: new Float32Array(LEVELS), ask: new Float32Array(LEVELS) });

  useFrame((_, rawDelta) => {
    const bidMesh = bids.current;
    const askMesh = asks.current;
    if (!bidMesh || !askMesh) return;

    const delta = step(rawDelta);
    const book = currentBook();
    const blend = 1 - Math.exp(-EASE * delta);

    const peak = book
      ? Math.max(
          book.bids[book.bids.length - 1]?.cumulative ?? 1,
          book.asks[book.asks.length - 1]?.cumulative ?? 1,
        )
      : 1;

    for (const [side, mesh, tint] of [
      ["bid", bidMesh, BID],
      ["ask", askMesh, ASK],
    ] as const) {
      const levels = side === "bid" ? book?.bids : book?.asks;
      const direction = side === "bid" ? -1 : 1;
      const eased = shown.current[side];

      for (let i = 0; i < LEVELS; i++) {
        const target = levels?.[i] ? (levels[i].cumulative / peak) * MAX_HEIGHT : 0;
        eased[i] += (target - eased[i]) * blend;
        const height = Math.max(0.01, eased[i]);

        dummy.position.set(direction * (i + 0.7) * STEP, height / 2, 0);
        dummy.scale.set(WIDTH, height, DEPTH);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      void tint;
    }
  });

  return (
    <group>
      <instancedMesh ref={bids} args={[undefined, undefined, LEVELS]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color="#00e5b0"
          emissive="#00e5b0"
          emissiveIntensity={0.45}
          metalness={0.3}
          roughness={0.35}
          transparent
          opacity={0.88}
        />
      </instancedMesh>

      <instancedMesh ref={asks} args={[undefined, undefined, LEVELS]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color="#ff2e88"
          emissive="#ff2e88"
          emissiveIntensity={0.45}
          metalness={0.3}
          roughness={0.35}
          transparent
          opacity={0.88}
        />
      </instancedMesh>

      {/* The spread, standing in the gap between the two walls. */}
      <mesh position={[0, MAX_HEIGHT / 2, 0]}>
        <boxGeometry args={[0.035, MAX_HEIGHT, DEPTH * 0.98]} />
        <meshBasicMaterial color="#00e5ff" toneMapped={false} transparent opacity={0.55} />
      </mesh>
    </group>
  );
}
