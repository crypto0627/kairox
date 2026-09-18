"use client";

import { Suspense, type RefObject } from "react";
import { RoundedBox } from "@react-three/drei";
import { RobotTrader } from "./RobotTrader";
import { VerdictHolo } from "./VerdictHolo";
import { useAgentStore } from "@/lib/store/agentStore";

export interface WorkstationProps {
  seed: number;
  symbolId: string;
  sentimentRef: RefObject<Record<string, number>>;
  position?: [number, number, number];
  rotation?: [number, number, number];
}

const METAL = "#0b1119";
const METAL_DARK = "#070b11";

/**
 * A standing console with its trader.
 *
 * Everything the trader uses sits at negative z — in front of the robot and
 * therefore *behind* it from the camera, which is at +z. That ordering is the
 * point: seated the other way round, the monitor stood between the camera and
 * the body and every robot was a visor floating over a black slab.
 *
 * The robot itself stays behind a stable prop shape, so the console does not
 * care that the body is now a GLTF rig.
 */
export function Workstation({
  seed,
  symbolId,
  sentimentRef,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
}: WorkstationProps) {
  return (
    <group position={position} rotation={rotation}>
      {/* --- console body --- */}
      <mesh position={[0, 0.47, -0.74]} castShadow receiveShadow>
        <boxGeometry args={[1.68, 0.94, 0.66]} />
        <meshStandardMaterial color={METAL_DARK} metalness={0.72} roughness={0.42} />
      </mesh>
      <RoundedBox
        args={[1.82, 0.08, 0.84]}
        radius={0.02}
        smoothness={3}
        position={[0, 0.98, -0.72]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color={METAL} metalness={0.68} roughness={0.38} />
      </RoundedBox>

      {/* edge light on the side the trader stands at */}
      <mesh position={[0, 0.937, -0.31]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.7, 0.028]} />
        <meshBasicMaterial color="#ff2e88" toneMapped={false} />
      </mesh>

      {/* kick strip along the floor */}
      <mesh position={[0, 0.03, -0.41]}>
        <planeGeometry args={[1.62, 0.02]} />
        <meshBasicMaterial color="#8b5cf6" toneMapped={false} />
      </mesh>

      {/* --- screens: one main, two angled wings --- */}
      <group position={[0, 1.44, -0.86]} rotation={[-0.1, 0, 0]}>
        <mesh castShadow>
          <boxGeometry args={[1.02, 0.44, 0.04]} />
          <meshStandardMaterial color="#05080c" metalness={0.72} roughness={0.32} />
        </mesh>
        <mesh position={[0, 0, 0.024]}>
          <planeGeometry args={[0.96, 0.38]} />
          <meshBasicMaterial color="#0d3a45" toneMapped={false} />
        </mesh>
      </group>
      {[-1, 1].map((side) => (
        <group
          key={side}
          position={[side * 0.74, 1.3, -0.78]}
          rotation={[-0.08, side * -0.5, 0]}
        >
          <mesh castShadow>
            <boxGeometry args={[0.52, 0.32, 0.035]} />
            <meshStandardMaterial color="#05080c" metalness={0.72} roughness={0.32} />
          </mesh>
          <mesh position={[0, 0, 0.022]}>
            <planeGeometry args={[0.48, 0.27]} />
            <meshBasicMaterial color="#0a2a33" toneMapped={false} />
          </mesh>
        </group>
      ))}

      {/* monitor spine */}
      <mesh position={[0, 1.13, -0.86]}>
        <boxGeometry args={[0.1, 0.32, 0.06]} />
        <meshStandardMaterial color={METAL_DARK} metalness={0.7} roughness={0.4} />
      </mesh>

      {/* --- deck: an angled input panel, lit from within --- */}
      <mesh position={[0, 1.025, -0.56]} rotation={[-0.22, 0, 0]} castShadow>
        <boxGeometry args={[0.78, 0.02, 0.3]} />
        <meshStandardMaterial
          color="#0b1118"
          emissive="#00e5ff"
          emissiveIntensity={0.55}
          metalness={0.4}
          roughness={0.6}
        />
      </mesh>

      {/* --- clutter: a stack of units and a cable run --- */}
      <mesh position={[0.66, 1.06, -0.55]} castShadow>
        <boxGeometry args={[0.22, 0.09, 0.16]} />
        <meshStandardMaterial color={METAL} metalness={0.7} roughness={0.45} />
      </mesh>
      <mesh position={[0.66, 1.112, -0.478]}>
        <planeGeometry args={[0.18, 0.012]} />
        <meshBasicMaterial color="#00e5b0" toneMapped={false} />
      </mesh>
      <mesh position={[-0.7, 1.05, -0.52]} rotation={[0, 0.3, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.06, 0.07, 10]} />
        <meshStandardMaterial color={METAL} metalness={0.6} roughness={0.5} />
      </mesh>
      <mesh position={[-0.62, 0.5, -0.42]} rotation={[0.12, 0, 0.2]}>
        <cylinderGeometry args={[0.014, 0.014, 0.95, 6]} />
        <meshStandardMaterial color="#05080c" metalness={0.3} roughness={0.9} />
      </mesh>

      {/* Click target: one generous invisible box over the trader and its
          console. Raycasting the GLTF's own meshes would work but gives a
          fiddly hit area shaped like a robot, and the desk should select the
          agent too. Opacity zero rather than visible={false}, which is not
          reliably raycast. */}
      <mesh
        position={[0, 1.15, -0.4]}
        onClick={(event) => {
          event.stopPropagation();
          useAgentStore.getState().select(symbolId);
        }}
        onPointerOver={(event) => {
          event.stopPropagation();
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "";
        }}
      >
        <boxGeometry args={[2.1, 2.7, 1.7]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* What this agent currently thinks, hanging above its head. */}
      <VerdictHolo symbolId={symbolId} />

      {/* The rig streams in on its own boundary so a slow model never blanks
          the whole room. */}
      <Suspense fallback={null}>
        <RobotTrader seed={seed} symbolId={symbolId} sentimentRef={sentimentRef} />
      </Suspense>
    </group>
  );
}
