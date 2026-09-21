"use client";

import { Suspense, useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { usePathname } from "next/navigation";
import { Vector3 } from "three";
import { Workstation } from "./Workstation";
import { ScreenArray } from "./ScreenArray";
import { Room } from "./Room";
import { Interior } from "./Interior";
import { Supervisor } from "./Supervisor";
import { CursorMagic } from "./CursorMagic";
import dynamic from "next/dynamic";

/** The Pit is a storey of its own — loaded when you ride up to it, and
 *  unmounted when you leave, so the floor below never pays for it. */
const PitFloor = dynamic(() => import("./PitFloor").then((m) => m.PitFloor), {
  ssr: false,
});
const InteriorFloor = dynamic(
  () => import("./InteriorFloor").then((m) => m.InteriorFloor),
  { ssr: false },
);
import { CityScape } from "./CityScape";
import { Rain } from "./Rain";
import { Effects } from "./Effects";
import { useMarketStore } from "@/lib/store/marketStore";
import { SYMBOLS } from "@/lib/market/symbols";
import { floorFor, STOREY } from "@/lib/scene/floors";
import type { Dressing } from "./InteriorFloor";
import { WallScreen } from "./WallScreen";
import type { WallScreenProps } from "./WallScreen";

/** The storeys below the Pit, and how each one is dressed. */
const LOWER_FLOORS: Array<{
  path: string;
  level: number;
  accent: string;
  dressing: Dressing;
}> = [
  { path: "/report", level: -STOREY * 2, accent: "#ff2e88", dressing: "briefing" },
  { path: "/history", level: -STOREY * 3, accent: "#00e5b0", dressing: "archive" },
  { path: "/profile", level: -STOREY * 4, accent: "#8b5cf6", dressing: "ops" },
];

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

export function Scene({ screenSlot }: { screenSlot?: WallScreenProps["slot"] }) {
  const pathname = usePathname();
  // Read during render so OrbitControls gets the storey's own limits; the
  // position lerp stays in useFrame.
  const floor = floorFor(pathname);
  const limits = { min: floor.minDistance, max: floor.maxDistance };
  const { camera } = useThree();
  const controls = useRef<OrbitControlsImpl>(null);
  const target = useRef(new Vector3().copy(floorFor("/").camera));
  const lookAt = useRef(new Vector3().copy(floorFor("/").target));
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
    // The lift. Same lerp as before, but the destination now carries a storey
    // height, so changing route between floors rides the camera up the shaft
    // rather than cutting to it.
    const destination = floorFor(pathname);
    target.current.copy(destination.camera);
    lookAt.current.copy(destination.target);

    const ease = 1 - Math.pow(0.001, delta);
    camera.position.lerp(target.current, ease);
    controls.current?.target.lerp(lookAt.current, ease);

    // Geometric easing approaches but never arrives. Left alone the camera
    // writes a sub-pixel different matrix every frame forever — which on a
    // storey whose wall is a document means the text never quite stops
    // drifting under the cursor. Within a ten-thousandth of a unit, arrive.
    if (camera.position.distanceToSquared(target.current) < 1e-8) {
      camera.position.copy(target.current);
    }
    const orbit = controls.current;
    if (orbit && orbit.target.distanceToSquared(lookAt.current) < 1e-8) {
      orbit.target.copy(lookAt.current);
    }
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

      {/* Only the storey you are standing on is built. The trading floor is
          the exception — it is the one the lift passes through. */}
      {pathname === "/pit" && (
        <Suspense fallback={null}>
          <PitFloor />
        </Suspense>
      )}
      {LOWER_FLOORS.map(
        (floor) =>
          pathname === floor.path && (
            <Suspense key={floor.path} fallback={null}>
              <InteriorFloor
                level={floor.level}
                accent={floor.accent}
                dressing={floor.dressing}
              />
            </Suspense>
          ),
      )}

      <ScreenArray />

      {/* Walks the line; comes to the front on /report. */}
      <Suspense fallback={null}>
        <Supervisor />
      </Suspense>

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

      {/* The page, on the wall, where the storey has a screen for it. */}
      {floor.screen && screenSlot && (
        <WallScreen position={floor.screen} slot={screenSlot} />
      )}

      <CursorMagic />

      <Effects />

      <OrbitControls
        ref={controls}
        makeDefault
        enablePan={false}
        enableDamping
        dampingFactor={0.06}
        minDistance={limits.min}
        maxDistance={limits.max}
        minPolarAngle={Math.PI / 2 - 0.34}
        maxPolarAngle={Math.PI / 2 + 0.06}
        minAzimuthAngle={-0.35}
        maxAzimuthAngle={0.35}
      />
    </>
  );
}
