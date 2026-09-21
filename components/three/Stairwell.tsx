"use client";

import { useMemo } from "react";
import { STOREY } from "@/lib/scene/floors";
import {
  FLIGHT_RISE,
  LANE_A,
  LANE_B,
  RUN_X0,
  RUN_X1,
  SHAFT_X0,
  SHAFT_X1,
  SHAFT_Z0,
  SHAFT_Z1,
  STEPS_PER_FLIGHT,
  STEP_RISE,
  STEP_RUN,
} from "@/lib/scene/stairs";

const METAL = "#10161f";
const METAL_DARK = "#080c12";
const TREAD = "#161d28";

const SHAFT_W = SHAFT_Z1 - SHAFT_Z0;
const SHAFT_MID_Z = (SHAFT_Z0 + SHAFT_Z1) / 2;
const SHAFT_MID_X = (SHAFT_X0 + SHAFT_X1) / 2;
const LANE_W = SHAFT_W / 2 - 0.45;
const RUN = RUN_X1 - RUN_X0;

interface Tread {
  x: number;
  y: number;
  z: number;
}

/** One flight, precomputed: the stair never moves, so this is done once. */
function flight(level: number, lane: number, outward: boolean): Tread[] {
  const top = outward ? level : level - FLIGHT_RISE;
  return Array.from({ length: STEPS_PER_FLIGHT }, (_, i) => ({
    // The first flight heads away from the room, the second comes back;
    // that turn is the whole point of a switchback.
    x: outward ? RUN_X0 + (i + 0.5) * STEP_RUN : RUN_X1 - (i + 0.5) * STEP_RUN,
    y: top - (i + 0.5) * STEP_RISE,
    z: lane,
  }));
}

/** A handrail following a flight: a sloped bar on two stanchions, lit. */
function Rail({
  level,
  lane,
  outward,
  accent,
}: {
  level: number;
  lane: number;
  outward: boolean;
  accent: string;
}) {
  const top = outward ? level : level - FLIGHT_RISE;
  const midY = top - FLIGHT_RISE / 2 + 1;
  const midX = (RUN_X0 + RUN_X1) / 2;
  // Tilted so the bar lies along the flight rather than across it.
  const pitch = Math.atan2(FLIGHT_RISE, RUN) * (outward ? -1 : 1);
  const length = Math.hypot(FLIGHT_RISE, RUN);

  return (
    <group>
      <mesh position={[midX, midY, lane]} rotation={[0, 0, Math.PI / 2 + pitch]} castShadow>
        <cylinderGeometry args={[0.055, 0.055, length, 8]} />
        <meshStandardMaterial color={METAL} metalness={0.8} roughness={0.32} />
      </mesh>
      <mesh position={[midX, midY - 0.05, lane]} rotation={[Math.PI / 2, 0, pitch]}>
        <planeGeometry args={[length, 0.02]} />
        <meshBasicMaterial color={accent} toneMapped={false} />
      </mesh>
      {[0, 1].map((end) => (
        <mesh
          key={end}
          position={[
            end ? RUN_X1 - 0.4 : RUN_X0 + 0.4,
            (end ? top - FLIGHT_RISE * 0.92 : top - FLIGHT_RISE * 0.08) + 0.5,
            lane,
          ]}
          castShadow
        >
          <boxGeometry args={[0.07, 1, 0.07]} />
          <meshStandardMaterial color={METAL} metalness={0.78} roughness={0.36} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * One storey of the stair core: a flight out, a half landing, a flight back.
 *
 * Rendered per storey rather than once for the building, because only the
 * storeys next to the supervisor are ever mounted — the shaft is the one
 * place where two floors are visible at the same time, and it should cost two
 * floors, not five.
 *
 * `level` is the height of the landing by the door. Everything below is
 * derived from it and from the same constants `heightAt` reads, so the
 * geometry and the thing you walk on cannot disagree about where the treads
 * are.
 */
export function Stairwell({ level, accent = "#00e5ff" }: { level: number; accent?: string }) {
  const treads = useMemo(
    () => [...flight(level, LANE_A, true), ...flight(level, LANE_B, false)],
    [level],
  );

  const half = level - FLIGHT_RISE;
  const doorLanding = RUN_X0 - SHAFT_X0;
  const farLanding = SHAFT_X1 - RUN_X1;

  return (
    <group>
      {/* --- landings --- */}
      {/* level with the floor the door opens off */}
      <mesh position={[(SHAFT_X0 + RUN_X0) / 2, level - 0.09, SHAFT_MID_Z]} receiveShadow castShadow>
        <boxGeometry args={[doorLanding, 0.18, SHAFT_W]} />
        <meshStandardMaterial color={METAL} metalness={0.62} roughness={0.55} />
      </mesh>
      {/* where the stair turns back on itself */}
      <mesh position={[(RUN_X1 + SHAFT_X1) / 2, half - 0.09, SHAFT_MID_Z]} receiveShadow castShadow>
        <boxGeometry args={[farLanding, 0.18, SHAFT_W]} />
        <meshStandardMaterial color={METAL} metalness={0.62} roughness={0.55} />
      </mesh>

      {/* Which way is on.
          A switchback turns you through a hundred and eighty degrees, and a
          camera following you round the turn is looking back up the flight
          you just came down — so at exactly the two points where you have to
          choose, the way on is off screen. A mark on each landing points at
          the next flight. */}
      <mesh
        position={[SHAFT_X0 + doorLanding / 2, level + 0.02, LANE_A]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <circleGeometry args={[0.42, 3]} />
        <meshBasicMaterial color={accent} toneMapped={false} />
      </mesh>
      <mesh
        position={[SHAFT_X1 - farLanding / 2, half + 0.02, LANE_B]}
        rotation={[-Math.PI / 2, 0, Math.PI]}
      >
        <circleGeometry args={[0.42, 3]} />
        <meshBasicMaterial color={accent} toneMapped={false} />
      </mesh>

      {/* --- treads --- */}
      {treads.map((tread) => (
        <group key={`${tread.z}:${tread.y.toFixed(3)}`}>
          <mesh position={[tread.x, tread.y, tread.z]} castShadow receiveShadow>
            <boxGeometry args={[STEP_RUN, 0.14, LANE_W]} />
            <meshStandardMaterial color={TREAD} metalness={0.55} roughness={0.62} />
          </mesh>
          {/* nosing: a lit edge on every step, which is most of what you see
              of a stair in a room this dark */}
          <mesh
            position={[tread.x - STEP_RUN / 2 + 0.015, tread.y + 0.072, tread.z]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <planeGeometry args={[0.03, LANE_W - 0.1]} />
            <meshBasicMaterial color={accent} toneMapped={false} />
          </mesh>
        </group>
      ))}

      {/* The well between the flights is open, and has to stay open. A solid
          spine here is what a stair core really has, but it sits exactly
          between a following camera and the flight you are on: descending,
          the picture went black. A balustrade on each side does the same job
          for the eye and none of it for the camera. */}
      <Rail level={level} lane={LANE_A} outward accent={accent} />
      <Rail level={level} lane={LANE_B} outward={false} accent={accent} />
      <Rail level={level} lane={LANE_A / 3} outward accent={accent} />
      <Rail level={level} lane={LANE_B / 3} outward={false} accent={accent} />

      {/* --- the shaft's own walls --- */}
      <mesh position={[SHAFT_X1, level - STOREY / 2, SHAFT_MID_Z]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[SHAFT_W, STOREY]} />
        <meshStandardMaterial color={METAL_DARK} metalness={0.32} roughness={0.9} />
      </mesh>
      {[SHAFT_Z0, SHAFT_Z1].map((z) => (
        <mesh
          key={z}
          position={[SHAFT_MID_X, level - STOREY / 2, z]}
          rotation={[0, z > 0 ? Math.PI : 0, 0]}
        >
          <planeGeometry args={[SHAFT_X1 - SHAFT_X0, STOREY]} />
          <meshStandardMaterial color={METAL_DARK} metalness={0.32} roughness={0.9} />
        </mesh>
      ))}

      {/* a lamp on each landing, so the shaft is somewhere you can see to walk */}
      <pointLight
        position={[SHAFT_X0 + doorLanding / 2, level + 2.2, SHAFT_MID_Z]}
        intensity={26}
        distance={16}
        decay={2}
        color={accent}
      />
      <pointLight
        position={[SHAFT_X1 - farLanding / 2, half + 2.2, SHAFT_MID_Z]}
        intensity={22}
        distance={15}
        decay={2}
        color="#7fd8ff"
      />
    </group>
  );
}
