"use client";

import { useMemo } from "react";
import { DoubleSide, RepeatWrapping } from "three";
import { floorGridTexture } from "@/lib/three/textures";

/* Interior box. The camera never leaves it, so only the far wall is detailed. */
/**
 * Wider than it looks. The Report/History camera pulls back and off-centre,
 * and at 16 the frustum reached past the side walls and showed city where the
 * room should be. Walls are cheap; a visible seam is not.
 */
const HALF_WIDTH = 26;
const CEILING = 8.4;
const WINDOW_Z = -12;
const BACK_OF_ROOM = 10;
const DEPTH = BACK_OF_ROOM - WINDOW_Z;
const MID_Z = (WINDOW_Z + BACK_OF_ROOM) / 2;

/**
 * The glazed opening stops short of the room's full width and height. A
 * window that runs edge to edge leaves no wall in frame and the city stops
 * reading as something seen *from* somewhere.
 */
const GLASS_HALF = 13;
const SILL_TOP = 0.28;
const HEAD_BOTTOM = 7.8;

const BAYS = 8;
const MULLION_X = Array.from(
  { length: BAYS + 1 },
  (_, i) => -GLASS_HALF + (i * (GLASS_HALF * 2)) / BAYS,
);
const TRANSOM_Y = [3.0, 5.7];

/** Floor runs from the glass to well behind the camera, and no further. */
const FLOOR_DEPTH = 40;
const FLOOR_Z = WINDOW_Z + FLOOR_DEPTH / 2;

/**
 * The room the trading floor sits in: grid floor, side walls, ceiling with
 * light runs, and the window wall the city and the rain sit behind.
 *
 * All static — nothing here reads the market or animates, so it costs a
 * handful of draw calls and no per-frame work.
 */
export function Room() {
  const grid = useMemo(() => {
    const t = floorGridTexture().clone();
    t.wrapS = RepeatWrapping;
    t.wrapT = RepeatWrapping;
    // One cell every two world units across the floor plane.
    t.repeat.set(HALF_WIDTH, FLOOR_DEPTH / 2);
    t.needsUpdate = true;
    return t;
  }, []);

  return (
    <group>
      {/* --- floor: dark metal with the lattice laid over it ---
          Sized to the room and stopped at the glass. A floor that runs on
          past the window tiles the interior lattice out over the city. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, FLOOR_Z]} receiveShadow>
        <planeGeometry args={[HALF_WIDTH * 2, FLOOR_DEPTH]} />
        <meshStandardMaterial color="#070a10" metalness={0.72} roughness={0.38} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, FLOOR_Z]}>
        <planeGeometry args={[HALF_WIDTH * 2, FLOOR_DEPTH]} />
        <meshBasicMaterial
          map={grid}
          transparent
          opacity={0.2}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {/* Threshold strip: the run of floor between the desks and the glass
          is otherwise a dead black band at this camera. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, -6.4]}>
        <planeGeometry args={[GLASS_HALF * 2 - 2, 0.04]} />
        <meshBasicMaterial color="#8b5cf6" toneMapped={false} />
      </mesh>

      {/* --- side walls, each with a waist-height light run --- */}
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh
            position={[side * HALF_WIDTH, CEILING / 2, MID_Z]}
            rotation={[0, (-side * Math.PI) / 2, 0]}
          >
            <planeGeometry args={[DEPTH, CEILING]} />
            <meshStandardMaterial color="#080c14" metalness={0.35} roughness={0.85} />
          </mesh>
          <mesh
            position={[side * (HALF_WIDTH - 0.04), 2.1, MID_Z]}
            rotation={[0, (-side * Math.PI) / 2, 0]}
          >
            <planeGeometry args={[DEPTH, 0.035]} />
            <meshBasicMaterial color="#8b5cf6" toneMapped={false} />
          </mesh>
        </group>
      ))}

      {/* --- ceiling, with two light runs down its length --- */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, CEILING, MID_Z]}>
        <planeGeometry args={[HALF_WIDTH * 2, DEPTH]} />
        <meshStandardMaterial color="#06090f" metalness={0.3} roughness={0.92} />
      </mesh>
      {/* Battens run across the room, not along it. Lengthwise strips vanish
          to a point and the frame clips them into stray diagonals; transverse
          ones stay parallel to the window and read as ceiling. */}
      {[-10.2, -7.4].map((z) => (
        <mesh key={z} rotation={[Math.PI / 2, 0, 0]} position={[0, CEILING - 0.03, z]}>
          <planeGeometry args={[GLASS_HALF * 2 - 1, 0.11]} />
          <meshBasicMaterial color="#0b6f80" toneMapped={false} />
        </mesh>
      ))}

      {/* --- window wall --- */}
      {/* Glass: barely there, but it catches the room lights and keeps the
          city from reading as a hole cut in the wall. */}
      <mesh position={[0, (SILL_TOP + HEAD_BOTTOM) / 2, WINDOW_Z]}>
        <planeGeometry args={[GLASS_HALF * 2, HEAD_BOTTOM - SILL_TOP]} />
        <meshStandardMaterial
          color="#0a1420"
          transparent
          opacity={0.09}
          metalness={0.95}
          roughness={0.08}
          side={DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* piers either side of the opening */}
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[side * (GLASS_HALF + HALF_WIDTH) / 2, CEILING / 2, WINDOW_Z - 0.02]}
        >
          <planeGeometry args={[HALF_WIDTH - GLASS_HALF, CEILING]} />
          <meshStandardMaterial color="#080c14" metalness={0.4} roughness={0.8} />
        </mesh>
      ))}

      {/* header above the glass */}
      <mesh
        position={[0, (HEAD_BOTTOM + CEILING) / 2, WINDOW_Z - 0.02]}
      >
        <planeGeometry args={[GLASS_HALF * 2, CEILING - HEAD_BOTTOM]} />
        <meshStandardMaterial color="#080c14" metalness={0.4} roughness={0.8} />
      </mesh>

      {MULLION_X.map((x) => (
        <mesh key={x} position={[x, (SILL_TOP + HEAD_BOTTOM) / 2, WINDOW_Z]}>
          <boxGeometry args={[0.12, HEAD_BOTTOM - SILL_TOP, 0.22]} />
          <meshStandardMaterial color="#0a0f18" metalness={0.8} roughness={0.35} />
        </mesh>
      ))}
      {TRANSOM_Y.map((y) => (
        <mesh key={y} position={[0, y, WINDOW_Z]}>
          <boxGeometry args={[GLASS_HALF * 2, 0.1, 0.2]} />
          <meshStandardMaterial color="#0a0f18" metalness={0.8} roughness={0.35} />
        </mesh>
      ))}

      {/* sill and head trim, each carrying a light strip into the room */}
      <mesh position={[0, SILL_TOP / 2, WINDOW_Z + 0.06]}>
        <boxGeometry args={[HALF_WIDTH * 2, SILL_TOP, 0.5]} />
        <meshStandardMaterial color="#080d15" metalness={0.7} roughness={0.5} />
      </mesh>
      <mesh position={[0, SILL_TOP + 0.015, WINDOW_Z + 0.31]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[GLASS_HALF * 2 - 0.4, 0.05]} />
        <meshBasicMaterial color="#ff2e88" toneMapped={false} />
      </mesh>
      <mesh position={[0, HEAD_BOTTOM + 0.07, WINDOW_Z + 0.06]}>
        <boxGeometry args={[HALF_WIDTH * 2, 0.14, 0.42]} />
        <meshStandardMaterial color="#080d15" metalness={0.7} roughness={0.5} />
      </mesh>
      <mesh position={[0, HEAD_BOTTOM - 0.01, WINDOW_Z + 0.27]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[GLASS_HALF * 2 - 0.4, 0.045]} />
        <meshBasicMaterial color="#00e5ff" toneMapped={false} />
      </mesh>
    </group>
  );
}
