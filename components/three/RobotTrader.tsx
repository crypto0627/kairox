"use client";

import { useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import { Color, type Group, type Mesh, type MeshBasicMaterial } from "three";

export interface RobotTraderProps {
  /** Per-seat 0..1 value: varies pose, animation phase and typing speed. */
  seed: number;
  /** Which instrument drives this seat's visor colour. */
  symbolId: string;
  /**
   * Live sentiment by symbol id, written outside React render. Read only
   * inside useFrame so a price tick never re-renders the 3D tree.
   */
  sentimentRef: RefObject<Record<string, number>>;
}

const UP = new Color("#00e5ff");
const DOWN = new Color("#ff2e88");
const CHASSIS = "#0e1520";

/**
 * Procedural placeholder robot — the Phase 1 stand-in.
 *
 * Phase 5 swaps the body for a Mixamo GLTF behind these exact props:
 * useGLTF + SkeletonUtils.clone() + useAnimations, with `seed` driving
 * mixer.timeScale and mixer.setTime() so the five seats desync.
 */
export function RobotTrader({ seed, symbolId, sentimentRef }: RobotTraderProps) {
  const root = useRef<Group>(null);
  const head = useRef<Group>(null);
  const leftHand = useRef<Mesh>(null);
  const rightHand = useRef<Mesh>(null);
  const visor = useRef<MeshBasicMaterial>(null);
  const vent = useRef<MeshBasicMaterial>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime + seed * 7;

    if (root.current) root.current.position.y = Math.sin(t * 0.7) * 0.012;

    if (head.current) {
      head.current.rotation.y = Math.sin(t * 0.35) * 0.18;
      head.current.rotation.x = Math.sin(t * 0.5 + 1.2) * 0.05;
    }

    // Typing: hands alternate, phase-offset per seat, faster when the
    // instrument is moving.
    const change = sentimentRef.current?.[symbolId] ?? 0;
    const urgency = Math.min(1.6, 1 + Math.abs(change) * 0.25);
    const rate = 6 * (0.9 + seed * 0.3) * urgency;
    if (leftHand.current) {
      leftHand.current.position.y = 0.02 + Math.abs(Math.sin(t * rate)) * 0.035;
    }
    if (rightHand.current) {
      rightHand.current.position.y =
        0.02 + Math.abs(Math.sin(t * rate + 1.6)) * 0.035;
    }

    const tint = change < 0 ? DOWN : UP;
    visor.current?.color.lerp(tint, 0.08);
    vent.current?.color.lerp(tint, 0.08);
  });

  return (
    <group ref={root}>
      {/* torso */}
      <RoundedBox
        args={[0.46, 0.6, 0.3]}
        radius={0.07}
        smoothness={4}
        position={[0, 1.05, 0]}
        castShadow
      >
        <meshStandardMaterial color={CHASSIS} metalness={0.85} roughness={0.35} />
      </RoundedBox>

      {/* chest vent — emissive, Bloom will pick this up in Phase 5 */}
      <mesh position={[0, 1.12, 0.152]}>
        <planeGeometry args={[0.2, 0.05]} />
        <meshBasicMaterial ref={vent} color="#00e5ff" toneMapped={false} />
      </mesh>

      {/* head */}
      <group ref={head} position={[0, 1.48, 0]}>
        <RoundedBox args={[0.3, 0.28, 0.28]} radius={0.09} smoothness={4} castShadow>
          <meshStandardMaterial color={CHASSIS} metalness={0.9} roughness={0.25} />
        </RoundedBox>
        <mesh position={[0, 0.01, 0.142]}>
          <planeGeometry args={[0.2, 0.07]} />
          <meshBasicMaterial ref={visor} color="#00e5ff" toneMapped={false} />
        </mesh>
      </group>

      {/* arms */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 0.3, 1.2, 0]}>
          <mesh rotation={[0, 0, side * 0.35]} castShadow>
            <capsuleGeometry args={[0.055, 0.26, 4, 10]} />
            <meshStandardMaterial color={CHASSIS} metalness={0.8} roughness={0.4} />
          </mesh>
          <mesh position={[side * 0.08, -0.26, 0.18]} rotation={[1.1, 0, 0]} castShadow>
            <capsuleGeometry args={[0.048, 0.24, 4, 10]} />
            <meshStandardMaterial color={CHASSIS} metalness={0.8} roughness={0.4} />
          </mesh>
        </group>
      ))}

      {/* hands, on the keyboard */}
      <mesh ref={leftHand} position={[-0.16, 0.02, 0.44]}>
        <boxGeometry args={[0.1, 0.05, 0.11]} />
        <meshStandardMaterial color={CHASSIS} metalness={0.7} roughness={0.5} />
      </mesh>
      <mesh ref={rightHand} position={[0.16, 0.02, 0.44]}>
        <boxGeometry args={[0.1, 0.05, 0.11]} />
        <meshStandardMaterial color={CHASSIS} metalness={0.7} roughness={0.5} />
      </mesh>

      {/* chair */}
      <mesh position={[0, 0.42, -0.24]} castShadow>
        <boxGeometry args={[0.5, 0.62, 0.08]} />
        <meshStandardMaterial color="#080c12" metalness={0.5} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.06, -0.2]}>
        <cylinderGeometry args={[0.22, 0.26, 0.08, 16]} />
        <meshStandardMaterial color="#080c12" metalness={0.5} roughness={0.7} />
      </mesh>
    </group>
  );
}
