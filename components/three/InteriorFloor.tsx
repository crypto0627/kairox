"use client";

import { useMemo } from "react";
import { RepeatWrapping } from "three";
import { mulberry32 } from "@/lib/three/random";
import { floorGridTexture, hazardStripeTexture } from "@/lib/three/textures";

export type Dressing = "briefing" | "archive" | "ops";

const HALF_W = 12;
const DEPTH_BACK = -10;
const DEPTH_FRONT = 9;
/**
 * Tall enough for the display wall. A 5.6-unit screen hung at eye level does
 * not fit under a 4.2 ceiling, and a floor with a wall of screens is an
 * atrium storey anyway.
 */
const CEILING = 6.4;

const METAL = "#0c121b";
const METAL_DARK = "#070b11";

interface Props {
  level: number;
  accent: string;
  dressing: Dressing;
}

/**
 * The storeys below the trading floor.
 *
 * One shell, three dressings. These rooms exist because the lift needed
 * somewhere to arrive: each document page lays an opaque panel across the
 * middle of the screen, so what a room here has to do is fill the edges and
 * tell you which floor you got out on. Built to human scale — a 4.2 ceiling
 * and an eye at 2.1 — so it reads as being inside a building rather than
 * looking at a diorama.
 */
export function InteriorFloor({ level, accent, dressing }: Props) {
  const grid = useMemo(() => {
    const t = floorGridTexture().clone();
    t.wrapS = RepeatWrapping;
    t.wrapT = RepeatWrapping;
    t.repeat.set(HALF_W, (DEPTH_FRONT - DEPTH_BACK) / 2);
    t.needsUpdate = true;
    return t;
  }, []);

  const hazard = useMemo(() => {
    const t = hazardStripeTexture().clone();
    t.wrapS = RepeatWrapping;
    t.repeat.set(28, 1);
    t.needsUpdate = true;
    return t;
  }, []);

  const midZ = (DEPTH_BACK + DEPTH_FRONT) / 2;

  return (
    <group position={[0, level, 0]}>
      {/* floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, midZ]} receiveShadow>
        <planeGeometry args={[HALF_W * 2, DEPTH_FRONT - DEPTH_BACK]} />
        <meshStandardMaterial color="#070a10" metalness={0.7} roughness={0.4} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, midZ]}>
        <planeGeometry args={[HALF_W * 2, DEPTH_FRONT - DEPTH_BACK]} />
        <meshBasicMaterial map={grid} transparent opacity={0.16} depthWrite={false} toneMapped={false} />
      </mesh>

      {/* back wall */}
      <mesh position={[0, CEILING / 2, DEPTH_BACK]}>
        <planeGeometry args={[HALF_W * 2, CEILING]} />
        <meshStandardMaterial color="#080c14" metalness={0.35} roughness={0.88} />
      </mesh>

      {/* side walls, each with a light run at waist height */}
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh
            position={[side * HALF_W, CEILING / 2, midZ]}
            rotation={[0, (-side * Math.PI) / 2, 0]}
          >
            <planeGeometry args={[DEPTH_FRONT - DEPTH_BACK, CEILING]} />
            <meshStandardMaterial color="#080c14" metalness={0.35} roughness={0.88} />
          </mesh>
          <mesh
            position={[side * (HALF_W - 0.03), 1.15, midZ]}
            rotation={[0, (-side * Math.PI) / 2, 0]}
          >
            <planeGeometry args={[DEPTH_FRONT - DEPTH_BACK, 0.03]} />
            <meshBasicMaterial color={accent} toneMapped={false} />
          </mesh>
        </group>
      ))}

      {/* ceiling and its battens */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, CEILING, midZ]}>
        <planeGeometry args={[HALF_W * 2, DEPTH_FRONT - DEPTH_BACK]} />
        <meshStandardMaterial color="#06090f" metalness={0.3} roughness={0.92} />
      </mesh>
      {[-6.5, -2.5, 1.5, 5.5].map((z) => (
        <mesh key={z} rotation={[Math.PI / 2, 0, 0]} position={[0, CEILING - 0.02, z]}>
          <planeGeometry args={[HALF_W * 1.5, 0.1]} />
          <meshBasicMaterial color="#0b6f80" toneMapped={false} />
        </mesh>
      ))}

      {/* threshold marking where you step out of the lift */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 7.4]}>
        <planeGeometry args={[HALF_W * 1.7, 0.34]} />
        <meshBasicMaterial map={hazard} toneMapped={false} opacity={0.6} transparent />
      </mesh>

      {dressing === "briefing" && <Briefing accent={accent} />}
      {dressing === "archive" && <Archive accent={accent} />}
      {dressing === "ops" && <Ops accent={accent} />}

      <hemisphereLight args={["#1b2a44", "#140b16", 0.3]} />
      <pointLight position={[0, CEILING - 0.6, -3]} intensity={12} distance={16} decay={2} color={accent} />
      <pointLight position={[0, CEILING - 0.6, 4]} intensity={9} distance={14} decay={2} color="#00e5ff" />
    </group>
  );
}

/** Where the supervisor delivers. A podium and rows facing it. */
function Briefing({ accent }: { accent: string }) {
  return (
    <group>
      <mesh position={[0, 0.55, -7.2]} castShadow>
        <boxGeometry args={[1.5, 1.1, 0.7]} />
        <meshStandardMaterial color={METAL} metalness={0.75} roughness={0.38} />
      </mesh>
      <mesh position={[0, 1.13, -6.86]} rotation={[-0.35, 0, 0]}>
        <planeGeometry args={[1.2, 0.5]} />
        <meshBasicMaterial color={accent} toneMapped={false} transparent opacity={0.35} />
      </mesh>

      {[-4.5, -2.6, -0.7].map((z, row) =>
        [-3.6, -1.2, 1.2, 3.6].map((x) => (
          <group key={`${z}:${x}`} position={[x, 0, z]}>
            <mesh position={[0, 0.42, 0]} castShadow>
              <boxGeometry args={[0.9, 0.08, 0.5]} />
              <meshStandardMaterial color={METAL} metalness={0.6} roughness={0.5} />
            </mesh>
            <mesh position={[0, 0.2, 0]}>
              <boxGeometry args={[0.1, 0.42, 0.1]} />
              <meshStandardMaterial color={METAL_DARK} metalness={0.6} roughness={0.6} />
            </mesh>
            <mesh position={[0, 0.72, -0.22]}>
              <boxGeometry args={[0.86, 0.55, 0.06]} />
              <meshStandardMaterial color={METAL_DARK} metalness={0.5} roughness={0.7} />
            </mesh>
            {row === 0 && (
              <mesh position={[0, 0.465, 0.2]}>
                <planeGeometry args={[0.6, 0.015]} />
                <meshBasicMaterial color={accent} toneMapped={false} />
              </mesh>
            )}
          </group>
        )),
      )}
    </group>
  );
}

/** Rows of record slabs, lit from within. */
function Archive({ accent }: { accent: string }) {
  const slabs = useMemo(() => {
    const random = mulberry32(0xa5c17e);
    return Array.from({ length: 48 }, (_, i) => ({
      x: (i % 12) * 1.85 - 10.2,
      z: -8.2 + Math.floor(i / 12) * 2.5,
      lit: random() < 0.55,
      height: 1.5 + random() * 0.9,
    }));
  }, []);

  return (
    <group>
      {slabs.map((slab) => (
        <group key={`${slab.x}:${slab.z}`} position={[slab.x, 0, slab.z]}>
          <mesh position={[0, slab.height / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.15, slab.height, 0.38]} />
            <meshStandardMaterial color={METAL} metalness={0.8} roughness={0.32} />
          </mesh>
          <mesh position={[0, slab.height * 0.62, 0.195]}>
            <planeGeometry args={[0.85, slab.height * 0.5]} />
            <meshBasicMaterial
              color={slab.lit ? accent : "#0d1a22"}
              toneMapped={false}
              transparent
              opacity={slab.lit ? 0.5 : 0.85}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** The control room: racks down both sides, consoles in the middle. */
function Ops({ accent }: { accent: string }) {
  const leds = useMemo(() => {
    const random = mulberry32(0x0b5c0d);
    return Array.from({ length: 30 }, () => ({
      y: 0.5 + random() * 1.5,
      w: 0.25 + random() * 0.3,
      on: random() < 0.75,
    }));
  }, []);

  return (
    <group>
      {[-1, 1].map((side) =>
        [-8, -6.2, -4.4, -2.6, -0.8].map((z, i) => (
          <group key={`${side}:${z}`} position={[side * 9.4, 0, z]}>
            <mesh position={[0, 1.1, 0]} castShadow receiveShadow>
              <boxGeometry args={[1.5, 2.2, 0.8]} />
              <meshStandardMaterial color={METAL} metalness={0.78} roughness={0.34} />
            </mesh>
            <mesh position={[side * -0.76, 1.1, 0]} rotation={[0, (side * Math.PI) / 2, 0]}>
              <planeGeometry args={[0.72, 2.0]} />
              <meshStandardMaterial color="#04070b" metalness={0.4} roughness={0.95} />
            </mesh>
            {leds.slice(i * 6, i * 6 + 6).map((led, j) => (
              <mesh
                key={j}
                position={[side * -0.765, led.y, -0.12 + j * 0.05]}
                rotation={[0, (side * Math.PI) / 2, 0]}
              >
                <planeGeometry args={[led.w, 0.02]} />
                <meshBasicMaterial
                  color={led.on ? accent : "#123"}
                  toneMapped={false}
                />
              </mesh>
            ))}
          </group>
        )),
      )}

      {/* operator consoles */}
      {[-3.2, 0, 3.2].map((x) => (
        <group key={x} position={[x, 0, -4]}>
          <mesh position={[0, 0.48, 0]} castShadow receiveShadow>
            <boxGeometry args={[2.1, 0.96, 0.9]} />
            <meshStandardMaterial color={METAL_DARK} metalness={0.7} roughness={0.42} />
          </mesh>
          <mesh position={[0, 1.0, 0]} castShadow>
            <boxGeometry args={[2.3, 0.07, 1.0]} />
            <meshStandardMaterial color={METAL} metalness={0.68} roughness={0.38} />
          </mesh>
          <mesh position={[0, 1.42, -0.3]} rotation={[-0.12, 0, 0]}>
            <boxGeometry args={[1.5, 0.72, 0.04]} />
            <meshStandardMaterial color="#05080c" metalness={0.72} roughness={0.32} />
          </mesh>
          <mesh position={[0, 1.42, -0.276]} rotation={[-0.12, 0, 0]}>
            <planeGeometry args={[1.42, 0.64]} />
            <meshBasicMaterial color={accent} toneMapped={false} transparent opacity={0.22} />
          </mesh>
          <mesh position={[0, 1.04, 0.28]}>
            <planeGeometry args={[1.1, 0.02]} />
            <meshBasicMaterial color="#00e5b0" toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
