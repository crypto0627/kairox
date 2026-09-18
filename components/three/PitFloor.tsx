"use client";

import { DepthCanyon } from "./DepthCanyon";
import { IntelWall } from "./IntelWall";
import { STOREY } from "@/lib/scene/floors";

const HALF_WIDTH = 15;
const CEILING = 9;
const BACK_Z = -9.2;
const FRONT_Z = 9;

const METAL = "#0b1119";

/**
 * The Pit, one storey above the trading floor.
 *
 * Deliberately a plainer room than the floor below: the order book is terrain
 * you read by its silhouette and the wall is four dense panels, so anything
 * else competing for attention in here would be noise. The shell is a box
 * with light where the eye needs an edge.
 */
export function PitFloor() {
  return (
    <group position={[0, STOREY, 0]}>
      {/* floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, (BACK_Z + FRONT_Z) / 2]} receiveShadow>
        <planeGeometry args={[HALF_WIDTH * 2, FRONT_Z - BACK_Z]} />
        <meshStandardMaterial color="#070a10" metalness={0.75} roughness={0.35} />
      </mesh>

      {/* the pit itself: a recessed ring of light the book stands in */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[4.9, 5.1, 64]} />
        <meshBasicMaterial color="#00e5ff" toneMapped={false} transparent opacity={0.55} />
      </mesh>

      {/* back wall, carrying the intel */}
      <mesh position={[0, CEILING / 2, BACK_Z - 0.1]}>
        <planeGeometry args={[HALF_WIDTH * 2, CEILING]} />
        <meshStandardMaterial color="#080c14" metalness={0.4} roughness={0.85} />
      </mesh>

      {/* side walls */}
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh
            position={[side * HALF_WIDTH, CEILING / 2, (BACK_Z + FRONT_Z) / 2]}
            rotation={[0, (-side * Math.PI) / 2, 0]}
          >
            <planeGeometry args={[FRONT_Z - BACK_Z, CEILING]} />
            <meshStandardMaterial color="#080c14" metalness={0.35} roughness={0.88} />
          </mesh>
          <mesh
            position={[side * (HALF_WIDTH - 0.03), 2.4, (BACK_Z + FRONT_Z) / 2]}
            rotation={[0, (-side * Math.PI) / 2, 0]}
          >
            <planeGeometry args={[FRONT_Z - BACK_Z, 0.03]} />
            <meshBasicMaterial color="#8b5cf6" toneMapped={false} />
          </mesh>
        </group>
      ))}

      {/* ceiling and its runs */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, CEILING, (BACK_Z + FRONT_Z) / 2]}>
        <planeGeometry args={[HALF_WIDTH * 2, FRONT_Z - BACK_Z]} />
        <meshStandardMaterial color="#06090f" metalness={0.3} roughness={0.92} />
      </mesh>
      {[-3.5, 3.5].map((z) => (
        <mesh key={z} rotation={[Math.PI / 2, 0, 0]} position={[0, CEILING - 0.04, z]}>
          <planeGeometry args={[HALF_WIDTH * 1.7, 0.12]} />
          <meshBasicMaterial color="#0b6f80" toneMapped={false} />
        </mesh>
      ))}

      {/* --- the contents --- */}
      <group position={[0, 0.02, 0]}>
        <DepthCanyon />
      </group>

      <group position={[0, 4.6, BACK_Z]}>
        <IntelWall />
      </group>

      {/* light on the book and on the wall */}
      <pointLight position={[0, 6.2, 3.5]} intensity={30} distance={20} decay={2} color="#00e5ff" />
      <pointLight position={[0, 5, BACK_Z + 3]} intensity={16} distance={16} decay={2} color="#8b5cf6" />
      <hemisphereLight args={["#1b2a44", "#140b16", 0.35]} />
      <mesh position={[0, 0.06, 6.6]}>
        <boxGeometry args={[HALF_WIDTH * 1.6, 0.1, 0.12]} />
        <meshStandardMaterial color={METAL} metalness={0.8} roughness={0.35} />
      </mesh>
    </group>
  );
}
