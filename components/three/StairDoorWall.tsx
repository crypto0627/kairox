"use client";

import { DOOR_HALF_W, DOOR_HEIGHT, DOOR_Z } from "@/lib/scene/stairs";

/**
 * The right-hand wall of a cellular storey, with the way out to the stair cut
 * into it.
 *
 * Shared by every enclosed room rather than copied into each, because the
 * opening has to line up with the slot the supervisor can actually walk
 * through — and that slot is defined once, in `stairs.ts`. Two rooms with two
 * copies of these numbers is two chances to put a door where there is a wall.
 *
 * Built as two panels and a header instead of a plane with a hole: three
 * quads and no geometry to generate.
 */
export function StairDoorWall({
  x,
  back,
  front,
  ceiling,
  accent,
}: {
  /** Where the wall stands. */
  x: number;
  /** The room's depth, back to front. */
  back: number;
  front: number;
  ceiling: number;
  accent: string;
}) {
  const panels = [
    { z: (back + (DOOR_Z - DOOR_HALF_W)) / 2, depth: DOOR_Z - DOOR_HALF_W - back },
    { z: (DOOR_Z + DOOR_HALF_W + front) / 2, depth: front - DOOR_Z - DOOR_HALF_W },
  ];

  return (
    <group>
      {panels.map((panel) => (
        <group key={panel.z}>
          <mesh position={[x, ceiling / 2, panel.z]} rotation={[0, -Math.PI / 2, 0]}>
            <planeGeometry args={[panel.depth, ceiling]} />
            <meshStandardMaterial color="#080c14" metalness={0.35} roughness={0.88} />
          </mesh>
          <mesh position={[x - 0.03, 1.15, panel.z]} rotation={[0, -Math.PI / 2, 0]}>
            <planeGeometry args={[panel.depth, 0.03]} />
            <meshBasicMaterial color={accent} toneMapped={false} />
          </mesh>
        </group>
      ))}

      {/* the header over the opening */}
      <mesh position={[x, (DOOR_HEIGHT + ceiling) / 2, DOOR_Z]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[DOOR_HALF_W * 2, ceiling - DOOR_HEIGHT]} />
        <meshStandardMaterial color="#080c14" metalness={0.35} roughness={0.88} />
      </mesh>

      {/* lit jambs, so the way out is findable in a room this dark */}
      {[-1, 1].map((edge) => (
        <mesh
          key={edge}
          position={[x - 0.03, DOOR_HEIGHT / 2, DOOR_Z + edge * DOOR_HALF_W]}
          rotation={[0, -Math.PI / 2, 0]}
        >
          <planeGeometry args={[0.04, DOOR_HEIGHT]} />
          <meshBasicMaterial color={accent} toneMapped={false} />
        </mesh>
      ))}
      <mesh position={[x - 0.03, DOOR_HEIGHT, DOOR_Z]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[DOOR_HALF_W * 2, 0.04]} />
        <meshBasicMaterial color={accent} toneMapped={false} />
      </mesh>
    </group>
  );
}
