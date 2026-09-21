"use client";

import dynamic from "next/dynamic";
import { Suspense, useState } from "react";
import { createPortal } from "react-dom";
import { Canvas } from "@react-three/fiber";
import { ACESFilmicToneMapping, SRGBColorSpace } from "three";
import { useMarketFeed } from "@/lib/market/useMarketFeed";
import { useIsVisible } from "@/lib/three/environment";
import { useFloorKeys } from "@/lib/scene/useFloorKeys";
import { floorFor } from "@/lib/scene/floors";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { SceneBoundary } from "./SceneBoundary";
import { useVerdictScoring } from "@/lib/agent/useAgentFloor";

const Scene = dynamic(() => import("./Scene").then((m) => m.Scene), {
  ssr: false,
});

/**
 * Mounted once, from the shell layout. Navigating between routes must not
 * remount this — a fresh WebGL context costs a 1–2s black frame and drops
 * the feeds.
 */
export function SceneCanvas({ children }: { children?: ReactNode }) {
  // The feed lives here so it shares the component's lifetime with the scene.
  useMarketFeed();
  // Agents only speak when asked; this just grades what they said.
  useVerdictScoring();
  // Up and down ride the lift.
  useFloorKeys();

  // A hidden tab has no reason to render rain. The sockets stay open and the
  // store keeps filling — only the draw loop stops — so switching back shows
  // current prices rather than a scene catching up.
  const visible = useIsVisible();

  // A storey either shows its page on a screen in the room or floats it over
  // the canvas. Never both — children can only be rendered once.
  const onScreen = Boolean(floorFor(usePathname()).screen);

  // The screen's scrolling div, once the room has built one. The page is
  // portalled into it rather than passed down through <Canvas>, so it keeps
  // rendering in this tree: same router, same stores, same Suspense
  // boundaries, and still server-rendered even though the scene is not.
  const [slot, setSlot] = useState<HTMLDivElement | null>(null);

  return (
    <>
    <div className="absolute inset-0 z-0">
      <SceneBoundary>
      <Canvas
        shadows
        frameloop={visible ? "always" : "never"}
        dpr={[1, 1.75]}
        camera={{ position: [0, 3.2, 11], fov: 42, near: 0.1, far: 340 }}
        gl={{ antialias: false, powerPreference: "high-performance" }}
        onCreated={({ gl }) => {
          gl.toneMapping = ACESFilmicToneMapping;
          gl.toneMappingExposure = 0.85;
          gl.outputColorSpace = SRGBColorSpace;
        }}
      >
        <Suspense fallback={null}>
          <Scene screenSlot={onScreen ? setSlot : undefined} />
        </Suspense>
      </Canvas>
      </SceneBoundary>
    </div>

    {/* On a screen floor the page lives on the wall; everywhere else it is
        chrome over the room. z-10 either way. */}
    {onScreen
      ? slot && createPortal(children, slot)
      : <main className="pointer-events-none absolute inset-0 z-10">{children}</main>}
    </>
  );
}
