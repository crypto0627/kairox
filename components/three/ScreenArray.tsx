"use client";

import { HoloPanel } from "./HoloPanel";
import { SYMBOLS } from "@/lib/market/symbols";

const SPREAD = 3.32;
/** Arc curvature. Outer panels lean toward the camera, wrapping the floor. */
const BOW = 0.035;
const BASE_Z = -5.6;
const HEIGHT = 5.1;
const PANEL_WIDTH = 3.05;

const PANELS = SYMBOLS.map((spec, i) => {
  const x = (i - (SYMBOLS.length - 1) / 2) * SPREAD;
  return {
    id: spec.id,
    position: [x, HEIGHT, BASE_Z + BOW * x * x] as [number, number, number],
    // Tangent to that arc, so every panel squares up to the middle of the room
    // instead of showing the viewer its edge.
    rotation: [0, -Math.atan(2 * BOW * x), 0] as [number, number, number],
  };
});

/** The five-screen holo array above the desks. */
export function ScreenArray() {
  return (
    <group>
      {PANELS.map((p) => (
        <HoloPanel
          key={p.id}
          symbolId={p.id}
          width={PANEL_WIDTH}
          position={p.position}
          rotation={p.rotation}
        />
      ))}
    </group>
  );
}
