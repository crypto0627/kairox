"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { usePathname, useRouter } from "next/navigation";
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
import { FLOORS, floorFor, floorIndexFor, STOREY } from "@/lib/scene/floors";
import { Stairwell } from "./Stairwell";
import { placeOnStorey, walker } from "@/lib/scene/walker";
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

/** Eye height of the supervisor, which is what the camera hangs off. */
const HEAD = 1.5;

/** Where the camera sits the first time, relative to the supervisor: behind
 *  and a little above, far enough back that the room is still the subject. */
const BEHIND = new Vector3(0, 2.2, 5.8);

/**
 * The box the camera is allowed to be in.
 *
 * A boom long enough to frame a room is longer than the rooms are deep, so
 * left alone it reverses straight through the back wall — which is how the
 * first pass ended up looking at the briefing room from outside it, with two
 * other storeys visible through the floor. Sliding along the wall instead is
 * what every third-person camera does, and it costs one clamp.
 */
const CAM_X: [number, number] = [-11.2, 25.1];
const CAM_Z: [number, number] = [-9.3, 8.5];
const CAM_RISE: [number, number] = [-2.2, 3.4];

/** How far along the boom you can travel from `from` before leaving the slab
 *  between `lo` and `hi`. Infinite when the boom does not move on this axis. */
function span(from: number, lo: number, hi: number, step: number): number {
  if (step > 1e-6) return (hi - from) / step;
  if (step < -1e-6) return (lo - from) / step;
  return Infinity;
}

/** Is storey `index` close enough to `nearest` to be worth building? */
function near(nearest: number, index: number, reach = 1): boolean {
  return Math.abs(nearest - index) <= reach;
}

/** The nosing colour of each flight, so storeys read apart in the shaft. */
const STAIR_ACCENT = ["#00e5ff", "#ffb347", "#ff2e88", "#00e5b0"];

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
  const router = useRouter();
  const controls = useRef<OrbitControlsImpl>(null);
  /** Smoothed point the camera is hung from — the supervisor's head. */
  const follow = useRef(new Vector3(walker.x, walker.y + HEAD, walker.z));
  const desired = useRef(new Vector3());
  const shift = useRef(new Vector3());
  const boom = useRef(new Vector3());
  const sentimentRef = useRef<Record<string, number>>({});
  /**
   * The storey the supervisor is nearest. Held in state, not a ref, because
   * it decides which rooms are built — and it changes once per storey, not
   * once per frame.
   */
  const [nearest, setNearest] = useState(() => floorIndexFor(pathname));
  const nearestRef = useRef(nearest);
  const announced = useRef(pathname);
  const booted = useRef(false);

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
    const orbit = controls.current;
    if (!orbit) return;

    // The camera hangs off the supervisor rather than off the route. It is
    // translated by whatever the follow point moved, which leaves the angle
    // and the distance exactly as the viewer last set them — the old version
    // lerped the camera towards a fixed post every frame and so spent every
    // frame undoing the viewer's drag.
    desired.current.set(walker.x, walker.y + HEAD, walker.z);
    follow.current.lerp(desired.current, 1 - Math.pow(0.0002, delta));
    shift.current.subVectors(follow.current, orbit.target);
    orbit.target.add(shift.current);
    camera.position.add(shift.current);

    // Camera collision. Clamping each axis on its own flattened the boom
    // against the back wall and left the camera a foot from the back of their
    // head; shortening it along its own line is what a third-person camera
    // does — it slides in, keeps the angle, and lets go again on the way out.
    boom.current.subVectors(camera.position, follow.current);
    const reach = Math.min(
      1,
      span(follow.current.x, CAM_X[0], CAM_X[1], boom.current.x),
      span(follow.current.y, follow.current.y + CAM_RISE[0], follow.current.y + CAM_RISE[1], boom.current.y),
      span(follow.current.z, CAM_Z[0], CAM_Z[1], boom.current.z),
    );
    camera.position.copy(follow.current).addScaledVector(boom.current, Math.max(reach, 0.22));

    // Which storey are they on, and does the rest of the app know yet?
    let index = nearestRef.current;
    let best = Infinity;
    for (let i = 0; i < FLOORS.length; i += 1) {
      const gap = Math.abs(walker.y - FLOORS[i].level);
      if (gap < best) {
        best = gap;
        index = i;
      }
    }
    if (index !== nearestRef.current) {
      nearestRef.current = index;
      setNearest(index);
    }
    // Only once they are actually standing on it — halfway down a flight is
    // not an arrival, and pushing there would swap the room around them.
    const arrival = FLOORS[index].path;
    if (best < 0.4 && announced.current !== arrival) {
      announced.current = arrival;
      router.push(arrival);
    }
  });

  /**
   * Arriving by lift. Clicking the sidebar is still allowed to skip the
   * stairs, and when it does the supervisor has to be standing on the storey
   * that was asked for rather than four floors above it.
   */
  useEffect(() => {
    const destination = floorFor(pathname);
    announced.current = pathname;

    // First frame: stand the camera behind the supervisor. After this the
    // viewer owns the angle and nothing here touches it again.
    if (!booted.current) {
      booted.current = true;
      follow.current.set(walker.x, walker.y + HEAD, walker.z);
      camera.position.copy(follow.current).add(BEHIND);
      controls.current?.target.copy(follow.current);
    }

    if (Math.abs(walker.y - destination.level) < 0.5) return;
    const from = new Vector3(walker.x, walker.y + HEAD, walker.z);
    placeOnStorey(destination.level);
    const to = new Vector3(walker.x, walker.y + HEAD, walker.z);
    follow.current.copy(to);
    // Carry the camera by the same jump, so the viewer keeps their angle.
    camera.position.add(to.clone().sub(from));
    controls.current?.target.copy(to);
    // Which rooms to build is left to the frame loop, which is already
    // watching the supervisor's height and will notice on the next tick.
  }, [pathname, camera]);

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

      {/* The trading floor and its city. Built only while you are on it or
          one storey away — from the archive it is three floors of concrete
          up, and nothing down there can see it. */}
      {near(nearest, 0) && (
        <>
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
        </>
      )}

      {/* The storey you are on and the ones either side of it. Three rather
          than one because the stair is the one place two floors are visible
          at once: walking down a flight you should see the room you are
          leaving above you and the room you are entering below. */}
      {near(nearest, 1) && (
        <Suspense fallback={null}>
          <PitFloor />
        </Suspense>
      )}
      {LOWER_FLOORS.map(
        (lower, i) =>
          near(nearest, i + 2) && (
            <Suspense key={lower.path} fallback={null}>
              <InteriorFloor
                level={lower.level}
                accent={lower.accent}
                dressing={lower.dressing}
              />
            </Suspense>
          ),
      )}

      {/* The stair core. One flight pair per storey, for the storeys in
          reach — the shaft is what joins them, so it is mounted a storey
          wider than the rooms are. */}
      {FLOORS.slice(0, -1).map(
        (from, i) =>
          near(nearest, i, 2) && (
            <Stairwell key={from.id} level={from.level} accent={STAIR_ACCENT[i]} />
          ),
      )}

      {/* The one you drive. Mounted on every storey, because they walk
          between them. */}
      <Suspense fallback={null}>
        <Supervisor />
      </Suspense>

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
