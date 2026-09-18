"use client";

import type { RefObject } from "react";
import { RoundedBox } from "@react-three/drei";
import { RobotTrader } from "./RobotTrader";

export interface WorkstationProps {
  seed: number;
  symbolId: string;
  sentimentRef: RefObject<Record<string, number>>;
  position?: [number, number, number];
  rotation?: [number, number, number];
}

/** Desk rig + one robot. The desk stays procedural after the GLTF swap. */
export function Workstation({
  seed,
  symbolId,
  sentimentRef,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
}: WorkstationProps) {
  return (
    <group position={position} rotation={rotation}>
      <RoundedBox
        args={[1.5, 0.06, 0.72]}
        radius={0.02}
        smoothness={3}
        position={[0, 0.74, 0.5]}
        receiveShadow
        castShadow
      >
        <meshStandardMaterial color="#0b1118" metalness={0.6} roughness={0.45} />
      </RoundedBox>

      {/* desk edge light */}
      <mesh position={[0, 0.705, 0.858]}>
        <planeGeometry args={[1.46, 0.012]} />
        <meshBasicMaterial color="#ff2e88" toneMapped={false} />
      </mesh>

      {[-0.66, 0.66].map((x) => (
        <mesh key={x} position={[x, 0.37, 0.5]}>
          <boxGeometry args={[0.05, 0.74, 0.6]} />
          <meshStandardMaterial color="#070b10" metalness={0.5} roughness={0.7} />
        </mesh>
      ))}

      {/* monitor */}
      <group position={[0, 1.08, 0.25]} rotation={[-0.12, 0, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.92, 0.5, 0.03]} />
          <meshStandardMaterial color="#05080c" metalness={0.7} roughness={0.35} />
        </mesh>
        <mesh position={[0, 0, 0.018]}>
          <planeGeometry args={[0.87, 0.45]} />
          <meshBasicMaterial color="#0a2a33" toneMapped={false} />
        </mesh>
      </group>
      <mesh position={[0, 0.85, 0.25]}>
        <cylinderGeometry args={[0.03, 0.06, 0.16, 12]} />
        <meshStandardMaterial color="#070b10" metalness={0.6} roughness={0.5} />
      </mesh>

      {/* keyboard */}
      <mesh position={[0, 0.775, 0.62]} rotation={[-0.06, 0, 0]}>
        <boxGeometry args={[0.52, 0.015, 0.18]} />
        <meshStandardMaterial
          color="#0b1118"
          emissive="#00e5ff"
          emissiveIntensity={0.7}
          metalness={0.4}
          roughness={0.6}
        />
      </mesh>

      <RobotTrader seed={seed} symbolId={symbolId} sentimentRef={sentimentRef} />
    </group>
  );
}
