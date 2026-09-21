"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  Color,
  DoubleSide,
  Object3D,
  type InstancedMesh,
  type Mesh,
  type MeshBasicMaterial,
} from "three";
import { mulberry32 } from "@/lib/three/random";
import {
  adTexture,
  cityWindowTexture,
  holoAdTexture,
  nightSkyTexture,
  signStripTexture,
} from "@/lib/three/textures";

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

      // Two thirds of the towers burn amber, the rest cold blue. A skyline
      // tinted from a single hue reads as one flat wash; the warm/cool split
      // is what gives Night City its depth.
      const warm = random() < 0.66;
      tint.setHSL(
        warm ? 0.04 + random() * 0.08 : 0.54 + random() * 0.09,
        warm ? 0.62 : 0.45,
        0.26 + random() * 0.34,
      );
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


/* ---------------------------------------------------------------- signage */

interface Placed {
  position: [number, number, number];
  rotation: [number, number, number];
  size: [number, number];
  variant: number;
}

/**
 * Commercial panels bolted to the towers.
 *
 * This is the thing that makes a skyline read as Night City rather than as
 * any city at night: the corporate advertisement, oversized and everywhere.
 * Kept to the near half of the band, because past ~160 units the fog takes
 * them and the draw call is wasted.
 */
function Billboards() {
  const boards = useMemo<Placed[]>(() => {
    const random = mulberry32(0xb111b0a2);
    return Array.from({ length: 18 }, () => {
      const depth = random() * 0.55;
      const z = NEAR_Z + depth * (FAR_Z - NEAR_Z);
      const big = random() < 0.4;
      const width = big ? 16 + random() * 12 : 7 + random() * 6;
      return {
        position: [
          (random() * 2 - 1) * (SPAN_NEAR + depth * (SPAN_FAR - SPAN_NEAR)) * 0.85,
          10 + random() * 46,
          z + 6,
        ],
        rotation: [0, (random() - 0.5) * 0.7, 0],
        size: [width, width * (0.5 + random() * 0.25)],
        variant: Math.floor(random() * 5),
      };
    });
  }, []);

  return (
    <group>
      {boards.map((board, i) => (
        <mesh key={i} position={board.position} rotation={board.rotation}>
          <planeGeometry args={board.size} />
          <meshBasicMaterial
            map={adTexture(board.variant)}
            toneMapped={false}
            side={DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
}

/** Vertical signs stacked down the tower corners. */
function SignStrips() {
  const strips = useMemo<Placed[]>(() => {
    const random = mulberry32(0x519a115);
    return Array.from({ length: 22 }, () => {
      const depth = random() * 0.45;
      const z = NEAR_Z + depth * (FAR_Z - NEAR_Z);
      const height = 12 + random() * 22;
      return {
        position: [
          (random() * 2 - 1) * (SPAN_NEAR + depth * (SPAN_FAR - SPAN_NEAR)) * 0.9,
          6 + random() * 34,
          z + 7,
        ],
        rotation: [0, (random() - 0.5) * 0.5, 0],
        size: [height * 0.22, height],
        variant: Math.floor(random() * 5),
      };
    });
  }, []);

  return (
    <group>
      {strips.map((strip, i) => (
        <mesh key={i} position={strip.position} rotation={strip.rotation}>
          <planeGeometry args={strip.size} />
          <meshBasicMaterial
            map={signStripTexture(strip.variant)}
            toneMapped={false}
            side={DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
}

/** Aircraft warning lights. Static — forty dots blinking in unison is worse
 *  than forty dots that simply burn. */
function WarningLights() {
  const mesh = useRef<InstancedMesh>(null);
  const COUNT = 46;

  useLayoutEffect(() => {
    const target = mesh.current;
    if (!target) return;
    const random = mulberry32(0x1e0f1a);
    const dummy = new Object3D();
    const red = new Color("#ff2b2b");
    const amber = new Color("#ffb347");

    for (let i = 0; i < COUNT; i++) {
      const depth = random();
      dummy.position.set(
        (random() * 2 - 1) * (SPAN_NEAR + depth * (SPAN_FAR - SPAN_NEAR)),
        16 + random() * 74,
        NEAR_Z + depth * (FAR_Z - NEAR_Z),
      );
      const s = 0.5 + random() * 0.8;
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      target.setMatrixAt(i, dummy.matrix);
      target.setColorAt(i, random() < 0.7 ? red : amber);
    }
    target.instanceMatrix.needsUpdate = true;
    if (target.instanceColor) target.instanceColor.needsUpdate = true;
  }, []);

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, COUNT]} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial toneMapped={false} transparent opacity={0.95} />
    </instancedMesh>
  );
}

interface Flight {
  y: number;
  z: number;
  speed: number;
  offset: number;
  length: number;
}

const FLIGHT_SPAN = 210;

/** Air traffic: aerial vehicles crossing the gaps between the towers. */
function AirTraffic() {
  const mesh = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);

  const flights = useMemo<Flight[]>(() => {
    const random = mulberry32(0xa17a7f1c);
    return Array.from({ length: 14 }, () => ({
      y: 18 + random() * 58,
      z: NEAR_Z - 12 - random() * 110,
      speed: 5 + random() * 11,
      offset: random() * FLIGHT_SPAN * 2,
      length: 4 + random() * 5,
    }));
  }, []);

  useFrame(({ clock }) => {
    const target = mesh.current;
    if (!target) return;
    const t = clock.elapsedTime;

    for (let i = 0; i < flights.length; i++) {
      const f = flights[i];
      const x =
        (((f.offset + t * f.speed) % (FLIGHT_SPAN * 2)) + FLIGHT_SPAN * 2) %
          (FLIGHT_SPAN * 2) -
        FLIGHT_SPAN;
      dummy.position.set(x, f.y, f.z);
      dummy.scale.set(f.length, 1, 1);
      dummy.updateMatrix();
      target.setMatrixAt(i, dummy.matrix);
    }
    target.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, 14]} frustumCulled={false}>
      <planeGeometry args={[1, 0.22]} />
      <meshBasicMaterial color="#bfe4ff" toneMapped={false} transparent opacity={0.8} />
    </instancedMesh>
  );
}


/**
 * The building-sized hologram hanging over the district.
 *
 * Additive rather than alpha-blended: a projection adds light to whatever is
 * behind it, and blending it any other way makes it read as a billboard with
 * a hole cut in the skyline. It turns slowly and its scanlines crawl, which
 * is the whole of its animation budget.
 */
function HoloAd({
  position,
  size,
  sway,
}: {
  position: [number, number, number];
  size: [number, number];
  sway: number;
}) {
  const mesh = useRef<Mesh>(null);
  const texture = useMemo(() => holoAdTexture(), []);

  // Reached through the ref rather than through the memo: the scanline crawl
  // is a mutation, and mutating a render-time value is what the compiler
  // rules (rightly) refuse.
  useFrame(({ clock }, delta) => {
    const node = mesh.current;
    if (!node) return;
    const map = (node.material as MeshBasicMaterial).map;
    if (map) map.offset.y -= delta * 0.06;
    node.rotation.y = Math.sin(clock.elapsedTime * 0.06 + sway) * 0.42;
  });

  return (
    <mesh ref={mesh} position={position}>
      <planeGeometry args={size} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={0.42}
        blending={AdditiveBlending}
        depthWrite={false}
        side={DoubleSide}
        toneMapped={false}
      />
    </mesh>
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

      <Billboards />
      <SignStrips />
      <WarningLights />
      <AirTraffic />
      {/* In the open air between the glass and the first towers — anywhere
          inside the band and the skyline occludes it, which is the one thing
          a landmark hologram must never be.
          Pushed wide and dimmed once the signage became readable Chinese:
          abstract rings sat behind the panel array as texture, but bold
          characters in the same place read as foreground and fought the
          prices for the middle of the frame. */}
      <HoloAd position={[-38, 15, -74]} size={[19, 26]} sway={0} />
      <HoloAd position={[42, 17, -80]} size={[17, 23]} sway={2.1} />
    </group>
  );
}
