"use client";

import { useMemo } from "react";
import { AdditiveBlending, RepeatWrapping } from "three";
import { mulberry32 } from "@/lib/three/random";
import { hazardStripeTexture, puddleGlowTexture } from "@/lib/three/textures";

const CEILING = 8.4;
const WINDOW_Z = -12;

const METAL = "#0c121b";
const METAL_DARK = "#070b11";

/** Rack banks stand where the frame edges are, so they read without ever
 *  competing with the traders. */
const RACK_BANKS = [-12.1, 12.1];
const RACK_Z = [-10.4, -8.9, -7.4, -5.9, -4.4];

/** One server rack: a case, a vent seam and three runs of status LEDs. */
function Rack({ position, seed }: { position: [number, number, number]; seed: number }) {
  const random = useMemo(() => mulberry32(seed), [seed]);
  const leds = useMemo(
    () =>
      Array.from({ length: 3 }, (_, i) => ({
        y: 0.55 + i * 0.42,
        width: 0.3 + random() * 0.34,
        colour: random() < 0.68 ? "#00e5b0" : random() < 0.5 ? "#ffb347" : "#ff2e88",
      })),
    [random],
  );

  return (
    <group position={position}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[1.1, 2.15, 0.78]} />
        <meshStandardMaterial color={METAL} metalness={0.78} roughness={0.36} />
      </mesh>
      {/* vent seam */}
      <mesh position={[0, 1.88, 0.395]}>
        <planeGeometry args={[0.88, 0.1]} />
        <meshStandardMaterial color="#04070b" metalness={0.4} roughness={0.95} />
      </mesh>
      {leds.map((led) => (
        <mesh key={led.y} position={[-0.3, led.y, 0.396]}>
          <planeGeometry args={[led.width, 0.022]} />
          <meshBasicMaterial color={led.colour} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}


/** Neon smeared across standing water. See puddleGlowTexture for why this is
 *  a decal rather than a reflection pass. */
const PUDDLES: Array<{ at: [number, number]; size: [number, number]; colour: string }> = [
  { at: [-5.6, -2.2], size: [4.6, 2.6], colour: "#00e5ff" },
  { at: [3.1, -1.1], size: [5.4, 2.2], colour: "#ff2e88" },
  { at: [-1.4, 3.4], size: [6.2, 2.8], colour: "#ff9436" },
  { at: [8.2, 1.2], size: [3.8, 2.0], colour: "#8b5cf6" },
  { at: [-9.4, 0.4], size: [4.2, 2.2], colour: "#00e5b0" },
  { at: [6.4, -6.2], size: [5.0, 2.0], colour: "#ffb347" },
  { at: [-3.2, 6.4], size: [8.0, 3.2], colour: "#00e5ff" },
  { at: [5.8, 5.2], size: [6.4, 2.6], colour: "#ff2e88" },
];

/** Shipping crates, because a working floor accumulates them. */
const CRATES: Array<{ at: [number, number, number]; size: [number, number, number]; spin: number }> = [
  { at: [-7.9, 0.45, -6.4], size: [1.5, 0.9, 1.1], spin: 0.3 },
  { at: [-8.2, 1.25, -6.6], size: [1.1, 0.7, 0.9], spin: -0.2 },
  { at: [7.6, 0.5, -7.2], size: [1.6, 1.0, 1.2], spin: -0.35 },
  { at: [6.2, 0.4, -5.1], size: [1.3, 0.8, 1.0], spin: 0.15 },
  { at: [-6.4, 0.38, -4.2], size: [1.2, 0.76, 0.9], spin: -0.5 },
];


/** Cable bundles snaking across the floor. The near third of the frame is
 *  otherwise bare, and a working floor is never bare. */
const CABLES: Array<{ at: [number, number, number]; length: number; spin: number; colour: string }> = [
  { at: [-4.2, 0.035, 4.6], length: 13, spin: 0.09, colour: "#0a0e15" },
  { at: [2.6, 0.035, 5.9], length: 11, spin: -0.14, colour: "#0c1119" },
  { at: [-1.0, 0.035, 3.1], length: 15, spin: 0.03, colour: "#080c12" },
];

/**
 * What the room is made of besides its walls: structure, plant and markings.
 *
 * Night City's interiors are Entropism — function first, nothing hidden. The
 * conduit runs on the ceiling rather than above it, the racks stand in the
 * room rather than in a closet, and the floor is painted for people who work
 * on it. All static geometry; none of it costs a frame.
 */
export function Interior() {
  const puddleGlow = useMemo(() => puddleGlowTexture(), []);
  const hazard = useMemo(() => {
    const t = hazardStripeTexture().clone();
    t.wrapS = RepeatWrapping;
    t.wrapT = RepeatWrapping;
    t.repeat.set(34, 1);
    t.needsUpdate = true;
    return t;
  }, []);

  return (
    <group>
      {/* --- structural columns, framing the view --- */}
      {[-9.6, 9.6].map((x) => (
        <group key={x} position={[x, 0, -7.4]}>
          <mesh position={[0, CEILING / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.78, CEILING, 0.78]} />
            <meshStandardMaterial color={METAL} metalness={0.7} roughness={0.42} />
          </mesh>
          {/* corner light runs */}
          {[-1, 1].map((side) => (
            <mesh key={side} position={[side * 0.395, CEILING / 2, 0.2]}>
              <planeGeometry args={[0.02, CEILING - 0.6]} />
              <meshBasicMaterial color="#00e5ff" toneMapped={false} />
            </mesh>
          ))}
          {/* base collar */}
          <mesh position={[0, 0.16, 0]}>
            <boxGeometry args={[1.04, 0.32, 1.04]} />
            <meshStandardMaterial color={METAL_DARK} metalness={0.6} roughness={0.55} />
          </mesh>
        </group>
      ))}

      {/* --- server racks along both frame edges --- */}
      {RACK_BANKS.map((x) =>
        RACK_Z.map((z, i) => (
          <Rack
            key={`${x}:${z}`}
            position={[x, 1.08, z]}
            seed={0x2ac00 + Math.round(x * 10) * 31 + i}
          />
        )),
      )}

      {/* --- ceiling plant: two conduit runs and their hangers --- */}
      {[-4.2, 4.2].map((x) => (
        <group key={x}>
          <mesh position={[x, CEILING - 0.34, -3.6]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.13, 0.13, 15.6, 10]} />
            <meshStandardMaterial color={METAL} metalness={0.72} roughness={0.44} />
          </mesh>
          <mesh position={[x + 0.34, CEILING - 0.5, -3.6]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.07, 0.07, 15.6, 8]} />
            <meshStandardMaterial color={METAL_DARK} metalness={0.5} roughness={0.7} />
          </mesh>
          {[-10.5, -6.5, -2.5, 1.5].map((z) => (
            <mesh key={z} position={[x + 0.16, CEILING - 0.17, z]}>
              <boxGeometry args={[0.72, 0.1, 0.07]} />
              <meshStandardMaterial color={METAL_DARK} metalness={0.6} roughness={0.6} />
            </mesh>
          ))}
        </group>
      ))}

      {/* --- floor markings --- */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, WINDOW_Z + 1.5]}>
        <planeGeometry args={[25, 0.55]} />
        <meshBasicMaterial map={hazard} toneMapped={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, 2.4]}>
        <planeGeometry args={[25, 0.3]} />
        <meshBasicMaterial map={hazard} toneMapped={false} opacity={0.4} transparent />
      </mesh>

      {/* --- wet floor --- */}
      {PUDDLES.map((puddle) => (
        <mesh
          key={`${puddle.at[0]}:${puddle.at[1]}`}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[puddle.at[0], 0.012, puddle.at[1]]}
        >
          <planeGeometry args={puddle.size} />
          <meshBasicMaterial
            map={puddleGlow}
            color={puddle.colour}
            transparent
            opacity={0.3}
            blending={AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}

      {/* --- guard rail between the pit and the window walkway --- */}
      <group position={[0, 0, -10.4]}>
        {[-12, -8, -4, 0, 4, 8, 12].map((x) => (
          <mesh key={x} position={[x, 0.52, 0]} castShadow>
            <boxGeometry args={[0.08, 1.04, 0.08]} />
            <meshStandardMaterial color={METAL} metalness={0.76} roughness={0.38} />
          </mesh>
        ))}
        <mesh position={[0, 1.04, 0]} castShadow>
          <boxGeometry args={[24.4, 0.07, 0.11]} />
          <meshStandardMaterial color={METAL} metalness={0.8} roughness={0.32} />
        </mesh>
        <mesh position={[0, 1.085, 0.07]}>
          <planeGeometry args={[24.2, 0.022]} />
          <meshBasicMaterial color="#00e5ff" toneMapped={false} />
        </mesh>
        <mesh position={[0, 0.58, 0]}>
          <boxGeometry args={[24.4, 0.045, 0.07]} />
          <meshStandardMaterial color={METAL_DARK} metalness={0.7} roughness={0.5} />
        </mesh>
      </group>

      {/* --- floor cabling --- */}
      {CABLES.map((cable) => (
        <mesh
          key={cable.at[2]}
          position={cable.at}
          rotation={[0, cable.spin, Math.PI / 2]}
          castShadow
        >
          <cylinderGeometry args={[0.055, 0.055, cable.length, 7]} />
          <meshStandardMaterial color={cable.colour} metalness={0.25} roughness={0.85} />
        </mesh>
      ))}

      {/* --- crates --- */}
      {CRATES.map((crate) => (
        <group key={`${crate.at[0]}:${crate.at[2]}`} position={crate.at} rotation={[0, crate.spin, 0]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={crate.size} />
            <meshStandardMaterial color="#111721" metalness={0.62} roughness={0.55} />
          </mesh>
          <mesh position={[0, 0, crate.size[2] / 2 + 0.002]}>
            <planeGeometry args={[crate.size[0] * 0.72, 0.03]} />
            <meshBasicMaterial color="#ffb347" toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
