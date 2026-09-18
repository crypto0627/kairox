"use client";

import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { usePathname } from "next/navigation";
import * as THREE from "three";
import { Workstation } from "./Workstation";
import { useMarketStore } from "@/lib/store/marketStore";
import { SYMBOLS } from "@/lib/market/symbols";

/** Five seats on a shallow arc, mirroring the screen array above. */
const SEATS = SYMBOLS.map((spec, i) => {
  const spread = (i - (SYMBOLS.length - 1) / 2) * 2.05;
  return {
    id: spec.id,
    position: [spread, 0, -spread * spread * 0.06] as [number, number, number],
    rotation: [0, -spread * 0.05, 0] as [number, number, number],
    seed: i / (SYMBOLS.length - 1 || 1),
  };
});

const DASHBOARD_CAM = new THREE.Vector3(0, 3.2, 11);
const AWAY_CAM = new THREE.Vector3(-2.4, 3.6, 13.5);

export function Scene() {
  const pathname = usePathname();
  const { camera } = useThree();
  const target = useRef(new THREE.Vector3().copy(DASHBOARD_CAM));
  const sentimentRef = useRef<Record<string, number>>({});

  // Subscribe outside React render: a price tick must never re-render the
  // 3D tree. useFrame reads the ref.
  useRef(
    useMarketStore.subscribe((state) => {
      const next: Record<string, number> = {};
      for (const [id, q] of Object.entries(state.quotes)) next[id] = q.changePct;
      sentimentRef.current = next;
    }),
  );

  useFrame((_, delta) => {
    target.current.copy(pathname === "/" ? DASHBOARD_CAM : AWAY_CAM);
    camera.position.lerp(target.current, 1 - Math.pow(0.001, delta));
  });

  return (
    <>
      <color attach="background" args={["#05060b"]} />
      <fogExp2 attach="fog" args={["#070a16", 0.032]} />

      <hemisphereLight args={["#1b2a44", "#05060b", 0.35]} />
      <ambientLight intensity={0.12} />
      <directionalLight
        position={[-6, 9, 6]}
        intensity={0.45}
        color="#4a7fff"
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <pointLight position={[0, 5.2, 1]} intensity={14} distance={16} color="#00e5ff" />
      <pointLight position={[5.5, 1.6, 2]} intensity={9} distance={12} color="#ff2e88" />
      <pointLight position={[-5.5, 1.6, 2]} intensity={7} distance={12} color="#8b5cf6" />

      {/* floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color="#070a10" metalness={0.65} roughness={0.42} />
      </mesh>

      {/* back wall glow strip, stands in for the window wall until Phase 4 */}
      <mesh position={[0, 3.4, -9]}>
        <planeGeometry args={[26, 9]} />
        <meshStandardMaterial color="#070b14" metalness={0.3} roughness={0.9} />
      </mesh>
      <mesh position={[0, 6.3, -8.95]}>
        <planeGeometry args={[22, 0.04]} />
        <meshBasicMaterial color="#00e5ff" toneMapped={false} />
      </mesh>

      {SEATS.map((seat) => (
        <Workstation
          key={seat.id}
          seed={seat.seed}
          sentiment={sentimentRef.current[seat.id] ?? 0}
          position={seat.position}
          rotation={seat.rotation}
        />
      ))}

      <OrbitControls
        makeDefault
        target={[0, 2.4, 0]}
        enablePan={false}
        enableDamping
        dampingFactor={0.06}
        minDistance={8}
        maxDistance={15}
        minPolarAngle={Math.PI / 2 - 0.34}
        maxPolarAngle={Math.PI / 2 + 0.06}
        minAzimuthAngle={-0.35}
        maxAzimuthAngle={0.35}
      />
    </>
  );
}
