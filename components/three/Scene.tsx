"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { usePathname } from "next/navigation";
import { Vector3 } from "three";
import { Workstation } from "./Workstation";
import { ScreenArray } from "./ScreenArray";
import { Room } from "./Room";
import { Interior } from "./Interior";
import { CityScape } from "./CityScape";
import { Rain } from "./Rain";
import { Effects } from "./Effects";
import { useMarketStore } from "@/lib/store/marketStore";
import { SYMBOLS } from "@/lib/market/symbols";

/** Five seats on a shallow arc, mirroring the screen array above. */
const SEATS = SYMBOLS.map((spec, i) => {
  const spread = (i - (SYMBOLS.length - 1) / 2) * 2.05;
  return {
    id: spec.id,
    position: [spread, 0, -spread * spread * 0.06] as [number, number, number],
    rotation: [0, -spread * 0.05, 0] as [number, number, number],
    seed: i / Math.max(1, SYMBOLS.length - 1),
  };
});

const DASHBOARD_CAM = new Vector3(0, 3.2, 11);
const AWAY_CAM = new Vector3(-2.4, 3.6, 13.5);

export function Scene() {
  const pathname = usePathname();
  const { camera } = useThree();
  const target = useRef(new Vector3().copy(DASHBOARD_CAM));
  const sentimentRef = useRef<Record<string, number>>({});

  /**
   * Subscribe outside React render. A price tick must never re-render the
   * 3D tree — useFrame reads this ref instead.
   */
  useEffect(
    () =>
      useMarketStore.subscribe((state) => {
        const next: Record<string, number> = {};
        for (const [id, quote] of Object.entries(state.quotes)) {
          next[id] = quote.changePct;
        }
        sentimentRef.current = next;
      }),
    [],
  );

  useFrame((_, delta) => {
    target.current.copy(pathname === "/" ? DASHBOARD_CAM : AWAY_CAM);
    camera.position.lerp(target.current, 1 - Math.pow(0.001, delta));
  });

  return (
    <>
      <color attach="background" args={["#05060b"]} />
      {/* Tuned for the skyline, not the room: exp² fog squares with distance,
          so anything dense enough to haze a 20-unit room erases a 200-unit
          city. The room gets its atmosphere from the neon instead. */}
      <fogExp2 attach="fog" args={["#070a16", 0.0062]} />

      {/* --- lighting rig ---
          Night City reads warm against cold: sodium spill off the street
          coming in through the glass, cyan and magenta from the room's own
          signage. Every source here is deliberately weak — the emissive
          surfaces carry the scene and Bloom spends them. */}
      <hemisphereLight args={["#1b2a44", "#140b16", 0.28]} />
      <ambientLight intensity={0.1} />

      {/* key: the city itself, raking in through the window */}
      <directionalLight
        position={[-5, 13, -15]}
        intensity={0.55}
        color="#5b86ff"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={1}
        shadow-camera-far={44}
        shadow-camera-left={-18}
        shadow-camera-right={18}
        shadow-camera-top={15}
        shadow-camera-bottom={-5}
        shadow-bias={-0.0012}
      />

      {/* the warm half of the contrast: street light pooling at the glass */}
      <pointLight position={[0, 1.5, -10.5]} intensity={30} distance={24} decay={2} color="#ff9436" />
      <pointLight position={[-9, 2.4, -11]} intensity={14} distance={16} decay={2} color="#ffb056" />

      {/* the screen array spilling down onto the floor and the traders */}
      <pointLight position={[0, 4.1, -3.4]} intensity={24} distance={17} decay={2} color="#00e5ff" />

      {/* room accents */}
      <pointLight position={[8, 1.9, 1.5]} intensity={13} distance={14} decay={2} color="#ff2e88" />
      <pointLight position={[-8, 1.9, 1.5]} intensity={11} distance={14} decay={2} color="#8b5cf6" />

      <CityScape />
      <Rain />
      <Room />
      <Interior />

      <ScreenArray />

      {SEATS.map((seat) => (
        <Workstation
          key={seat.id}
          seed={seat.seed}
          symbolId={seat.id}
          sentimentRef={sentimentRef}
          position={seat.position}
          rotation={seat.rotation}
        />
      ))}

      <Effects />

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
