"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { AdditiveBlending, Color, Object3D, Vector3, type InstancedMesh } from "three";
import { puddleGlowTexture } from "@/lib/three/textures";
import { step, usePrefersReducedMotion } from "@/lib/three/environment";

/** Pool size. Every particle exists from the first frame and is recycled —
 *  allocating on a pointer move would garbage-collect mid-gesture. */
const POOL = 220;
/** Sparks per burst. */
const BURST = 9;
/** How far the pointer must travel before it throws another burst, in
 *  normalised screen units. Without it a resting hand emits forever. */
const TRAVEL = 0.010;
/** Where the sparks live: this far in front of the camera, so they sit over
 *  the floor rather than inside the desks. */
const DEPTH = 9;

const LIFE = 0.85;
const DRAG = 0.86;
const RISE = 0.55;

const VIOLET = new Color("#8b5cf6");
const WHITE = new Color("#ffffff");

/**
 * Sparks are authored past full brightness on purpose.
 *
 * The material is untone-mapped and additive, so a colour above 1.0 is legal
 * and is what puts a spark over Bloom's luminance threshold. At ordinary
 * brightness they were dots on a lit floor; this is what makes them glow.
 */
const GLOW = 3.2;

interface Spark {
  position: Vector3;
  velocity: Vector3;
  /** Seconds remaining. Zero means the slot is free. */
  life: number;
  size: number;
  tint: Color;
}

/**
 * Sparks that trail the cursor.
 *
 * Emitted from useFrame rather than a pointer handler: R3F only routes
 * pointer events to meshes under the cursor, and this has to fire over empty
 * room as well as over a trader. Reading the pointer each frame also throttles
 * the burst rate to the frame rate for free.
 *
 * Additive, and coloured between violet and white, so the post chain's Bloom
 * is what actually makes them read as magic rather than as dots.
 */
export function CursorMagic() {
  const mesh = useRef<InstancedMesh>(null);
  const { camera, pointer } = useThree();
  const stillness = usePrefersReducedMotion();

  const dummy = useMemo(() => new Object3D(), []);
  const texture = useMemo(() => puddleGlowTexture(), []);
  const scratch = useMemo(() => new Color(), []);
  const lastPointer = useRef({ x: 0, y: 0 });
  const cursor = useRef(0);

  // The pool lives in a ref built by an effect, not a memo. It is mutated
  // every frame, and a value produced during render is not something the
  // compiler rules will let you write to afterwards — the same reason the
  // rigs on this floor are assembled the same way.
  const sparks = useRef<Spark[] | null>(null);

  useEffect(() => {
    sparks.current = Array.from({ length: POOL }, () => ({
      position: new Vector3(),
      velocity: new Vector3(),
      life: 0,
      size: 0,
      tint: new Color(),
    }));
    return () => {
      sparks.current = null;
    };
  }, []);

  useFrame((_, rawDelta) => {
    const target = mesh.current;
    const pool = sparks.current;
    if (!target || !pool) return;
    const delta = step(rawDelta);

    // --- emit ---------------------------------------------------------
    const dx = pointer.x - lastPointer.current.x;
    const dy = pointer.y - lastPointer.current.y;
    if (Math.hypot(dx, dy) > TRAVEL) {
      lastPointer.current = { x: pointer.x, y: pointer.y };

      const origin = new Vector3(pointer.x, pointer.y, 0.5)
        .unproject(camera)
        .sub(camera.position)
        .normalize()
        .multiplyScalar(DEPTH)
        .add(camera.position);

      for (let i = 0; i < BURST; i++) {
        const spark = pool[cursor.current];
        cursor.current = (cursor.current + 1) % POOL;

        spark.position.copy(origin);
        spark.velocity.set(
          (Math.random() - 0.5) * 3.4,
          (Math.random() - 0.5) * 3.4,
          (Math.random() - 0.5) * 2.2,
        );
        spark.life = LIFE * (0.55 + Math.random() * 0.75);
        spark.size = 0.14 + Math.random() * 0.26;
        // A burst is mostly white at its heart and violet at its edges; the
        // mix is per spark so no two bursts read the same.
        spark.tint.copy(VIOLET).lerp(WHITE, Math.random() ** 2).multiplyScalar(GLOW);
      }
    }

    // --- integrate ----------------------------------------------------
    for (let i = 0; i < POOL; i++) {
      const spark = pool[i];

      if (spark.life <= 0) {
        // Parked at zero scale rather than removed: an InstancedMesh draws
        // every slot whether or not it is in use.
        dummy.scale.setScalar(0);
        dummy.position.set(0, -999, 0);
        dummy.updateMatrix();
        target.setMatrixAt(i, dummy.matrix);
        continue;
      }

      spark.life -= delta;
      const drag = DRAG ** (delta * 60);
      spark.velocity.multiplyScalar(drag);
      spark.velocity.y += RISE * delta;
      spark.position.addScaledVector(spark.velocity, delta);

      const fade = Math.max(0, spark.life / LIFE);
      dummy.position.copy(spark.position);
      // Sprites face the camera; without this they vanish edge-on.
      dummy.quaternion.copy(camera.quaternion);
      dummy.scale.setScalar(spark.size * (0.45 + fade * 0.95));
      dummy.updateMatrix();
      target.setMatrixAt(i, dummy.matrix);

      // Additive blending makes a darkened colour the same as a faded one, so
      // the tint carries the fade and the material stays shared.
      scratch.copy(spark.tint).multiplyScalar(fade ** 1.4);
      target.setColorAt(i, scratch);
    }

    target.instanceMatrix.needsUpdate = true;
    if (target.instanceColor) target.instanceColor.needsUpdate = true;
  });

  if (stillness) return null;

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, POOL]} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        map={texture}
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
        toneMapped={false}
      />
    </instancedMesh>
  );
}
