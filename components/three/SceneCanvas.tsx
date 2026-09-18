"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { ACESFilmicToneMapping, SRGBColorSpace } from "three";
import { useMarketFeed } from "@/lib/market/useMarketFeed";
import { useAgentFloor } from "@/lib/agent/useAgentFloor";

const Scene = dynamic(() => import("./Scene").then((m) => m.Scene), {
  ssr: false,
});

/**
 * Mounted once, from the shell layout. Navigating between routes must not
 * remount this — a fresh WebGL context costs a 1–2s black frame and drops
 * the feeds.
 */
export function SceneCanvas() {
  // The feed lives here so it shares the component's lifetime with the scene.
  useMarketFeed();
  // …and the agents that read it.
  useAgentFloor();

  return (
    <div className="absolute inset-0 z-0">
      <Canvas
        shadows
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
          <Scene />
        </Suspense>
      </Canvas>
    </div>
  );
}
