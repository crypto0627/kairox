"use client";

import { DepthCanyon } from "./DepthCanyon";
import { StairDoorWall } from "./StairDoorWall";
import { IntelWall } from "./IntelWall";
import { STOREY } from "@/lib/scene/floors";

const HALF_W = 12;
const BACK_Z = -8.2;
const FRONT_Z = 9;
/** Double height. The wall has to hang clear above the order book, and the
 *  book's tallest level rises most of the way to the rail. */
const CEILING = 9.2;

/** The well the book sits in. You stand at its rim. */
const WELL_HALF_W = 7.4;
const WELL_BACK = -5.9;
const WELL_FRONT = 0;
/**
 * Shallow on purpose.
 *
 * At three units the near lip cut the sight line off above the well floor,
 * so whichever side of the book was smaller vanished entirely — the bid wall
 * was simply not there. A pit you cannot see the bottom of is a hole.
 */
const WELL_DEPTH = 1.5;

const METAL = "#0b1119";
const METAL_DARK = "#070b11";

/**
 * The Pit, one storey below the trading floor.
 *
 * Laid out for standing in rather than looking at. The book is sunk below the
 * walkway so you read it over a rail — the first pass put the camera at book
 * height and the order walls filled the frame, burying the intel behind them.
 * The wall is ahead at eye level, where text on it is the size text on a wall
 * actually is.
 */
export function PitFloor() {
  const midZ = (BACK_Z + FRONT_Z) / 2;

  return (
    <group position={[0, -STOREY, 0]}>
      {/* walkway, the strip you stand on */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, (WELL_FRONT + FRONT_Z) / 2]}
        receiveShadow
      >
        <planeGeometry args={[HALF_W * 2, FRONT_Z - WELL_FRONT]} />
        <meshStandardMaterial color="#070a10" metalness={0.72} roughness={0.38} />
      </mesh>

      {/* the ledges either side of the well, and the one behind it */}
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[side * (WELL_HALF_W + (HALF_W - WELL_HALF_W) / 2), 0, (BACK_Z + WELL_FRONT) / 2]}
          receiveShadow
        >
          <planeGeometry args={[HALF_W - WELL_HALF_W, WELL_FRONT - BACK_Z]} />
          <meshStandardMaterial color="#070a10" metalness={0.72} roughness={0.38} />
        </mesh>
      ))}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, (BACK_Z + WELL_BACK) / 2]}
        receiveShadow
      >
        <planeGeometry args={[HALF_W * 2, WELL_BACK - BACK_Z]} />
        <meshStandardMaterial color="#070a10" metalness={0.72} roughness={0.38} />
      </mesh>

      {/* --- the well --- */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -WELL_DEPTH, (WELL_BACK + WELL_FRONT) / 2]}>
        <planeGeometry args={[WELL_HALF_W * 2, WELL_FRONT - WELL_BACK]} />
        <meshStandardMaterial color="#05080d" metalness={0.8} roughness={0.3} />
      </mesh>
      {/* its four walls */}
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[side * WELL_HALF_W, -WELL_DEPTH / 2, (WELL_BACK + WELL_FRONT) / 2]}
          rotation={[0, (-side * Math.PI) / 2, 0]}
        >
          <planeGeometry args={[WELL_FRONT - WELL_BACK, WELL_DEPTH]} />
          <meshStandardMaterial color="#080c14" metalness={0.6} roughness={0.6} />
        </mesh>
      ))}
      <mesh position={[0, -WELL_DEPTH / 2, WELL_BACK]}>
        <planeGeometry args={[WELL_HALF_W * 2, WELL_DEPTH]} />
        <meshStandardMaterial color="#080c14" metalness={0.6} roughness={0.6} />
      </mesh>
      <mesh position={[0, -WELL_DEPTH / 2, WELL_FRONT]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[WELL_HALF_W * 2, WELL_DEPTH]} />
        <meshStandardMaterial color="#080c14" metalness={0.6} roughness={0.6} />
      </mesh>
      {/* rim light all the way round */}
      {[
        [0, WELL_FRONT + 0.01, WELL_HALF_W * 2, 0],
        [0, WELL_BACK - 0.01, WELL_HALF_W * 2, 0],
      ].map(([x, z, w]) => (
        <mesh key={`${z}`} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.012, z]}>
          <planeGeometry args={[w, 0.05]} />
          <meshBasicMaterial color="#00e5ff" toneMapped={false} />
        </mesh>
      ))}

      {/* the rail you lean on */}
      <group position={[0, 0, WELL_FRONT + 0.22]}>
        {[-7, -4.2, -1.4, 1.4, 4.2, 7].map((x) => (
          <mesh key={x} position={[x, 0.5, 0]} castShadow>
            <boxGeometry args={[0.07, 1.0, 0.07]} />
            <meshStandardMaterial color={METAL} metalness={0.78} roughness={0.36} />
          </mesh>
        ))}
        <mesh position={[0, 1.0, 0]} castShadow>
          <boxGeometry args={[WELL_HALF_W * 2 + 0.6, 0.07, 0.1]} />
          <meshStandardMaterial color={METAL} metalness={0.8} roughness={0.3} />
        </mesh>
        <mesh position={[0, 1.045, 0.062]}>
          <planeGeometry args={[WELL_HALF_W * 2 + 0.4, 0.022]} />
          <meshBasicMaterial color="#00e5ff" toneMapped={false} />
        </mesh>
        <mesh position={[0, 0.56, 0]}>
          <boxGeometry args={[WELL_HALF_W * 2 + 0.6, 0.04, 0.06]} />
          <meshStandardMaterial color={METAL_DARK} metalness={0.7} roughness={0.5} />
        </mesh>
      </group>

      {/* The book, on a plinth toward the back of the well.
          Both sides share one normalisation — that is the point, it is how
          you see which side is heavier — so when one is a third of the other
          the short wall is genuinely short. Sat on the well floor at the
          near end, the rim cut the sight line above it and that whole side
          vanished. Back and up, every level clears the lip. */}
      <group position={[0, -WELL_DEPTH + 0.5, WELL_BACK + 1.7]}>
        <DepthCanyon />
      </group>
      <mesh position={[0, -WELL_DEPTH + 0.25, WELL_BACK + 1.7]}>
        <boxGeometry args={[WELL_HALF_W * 1.45, 0.5, 1.6]} />
        <meshStandardMaterial color="#080c14" metalness={0.7} roughness={0.5} />
      </mesh>

      {/* --- the room around it --- */}
      <mesh position={[0, CEILING / 2, BACK_Z - 0.1]}>
        <planeGeometry args={[HALF_W * 2, CEILING]} />
        <meshStandardMaterial color="#080c14" metalness={0.4} roughness={0.86} />
      </mesh>
      {/* the left wall is solid; the right one has the door to the stair */}
      <group>
        <mesh position={[-HALF_W, CEILING / 2, midZ]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[FRONT_Z - BACK_Z, CEILING]} />
          <meshStandardMaterial color="#080c14" metalness={0.35} roughness={0.88} />
        </mesh>
        <mesh position={[-(HALF_W - 0.03), 1.3, midZ]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[FRONT_Z - BACK_Z, 0.03]} />
          <meshBasicMaterial color="#8b5cf6" toneMapped={false} />
        </mesh>
      </group>
      <StairDoorWall
        x={HALF_W}
        back={BACK_Z}
        front={FRONT_Z}
        ceiling={CEILING}
        accent="#8b5cf6"
      />
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, CEILING, midZ]}>
        <planeGeometry args={[HALF_W * 2, FRONT_Z - BACK_Z]} />
        <meshStandardMaterial color="#06090f" metalness={0.3} roughness={0.92} />
      </mesh>
      {[-6, -2, 2, 6].map((z) => (
        <mesh key={z} rotation={[Math.PI / 2, 0, 0]} position={[0, CEILING - 0.03, z]}>
          <planeGeometry args={[HALF_W * 1.6, 0.11]} />
          <meshBasicMaterial color="#0b6f80" toneMapped={false} />
        </mesh>
      ))}

      {/* The wall, hung above the rail. Lower, the book's deep side climbed
          over the rim and covered the bottom row of panels. */}
      <group position={[0, 4.6, BACK_Z + 0.02]}>
        <IntelWall />
      </group>

      {/* light: one on the wall, one down into the well */}
      <pointLight position={[0, 6.4, -3]} intensity={16} distance={16} decay={2} color="#8b5cf6" />
      <pointLight position={[0, 1.4, -2.6]} intensity={22} distance={12} decay={2} color="#00e5ff" />
      <hemisphereLight args={["#1b2a44", "#140b16", 0.3]} />
    </group>
  );
}
