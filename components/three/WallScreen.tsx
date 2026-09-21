"use client";

import { useCallback } from "react";
import { Html } from "@react-three/drei";

/**
 * World units per CSS pixel is `distanceFactor / 400` in drei's transform
 * mode (Html.js, where the inner matrix is scaled by 1/(factor/400)). Fixing
 * the DOM at 1000 px wide and the factor at 4 makes the element exactly ten
 * world units across, so the screen's glass and its contents cannot drift
 * apart when either is retuned.
 */
const PX_W = 1000;
const PX_H = 560;
const FACTOR = 4;
const WORLD_W = (PX_W * FACTOR) / 400;
const WORLD_H = (PX_H * FACTOR) / 400;

/** Input the screen keeps for itself rather than letting the camera have. */
const SWALLOW = ["wheel", "pointerdown", "mousedown", "touchstart", "contextmenu"];

export interface WallScreenProps {
  /**
   * Receives the scrolling div once it exists. The page is *portalled* into
   * it from outside the Canvas rather than passed down as children, because
   * react-three-fiber renders through its own reconciler and does not bridge
   * React context across it: a Next.js page rendered in here loses
   * LayoutRouterContext and throws "invariant expected layout router to be
   * mounted". A portal keeps the page in the outer React tree — where its
   * router, store and theme contexts live — and only its DOM lands on the
   * screen.
   */
  slot: (node: HTMLDivElement | null) => void;
  position?: [number, number, number];
}

/**
 * A screen on the wall, showing real DOM.
 *
 * Drawn with `<Html transform>` rather than painted onto a CanvasTexture,
 * which is the difference between a picture of a document and a document:
 * the text stays crisp at any zoom, it scrolls, it can be selected, a screen
 * reader can read it, and Profile's form still has working inputs. A canvas
 * would have meant re-implementing text layout, scrolling and form controls
 * by hand, and losing all four.
 *
 * The scene's own rule is unchanged — the sidebar and the ticker are still
 * plain DOM above the canvas. This is content *on a screen in the room*,
 * which is a different thing from chrome floating over it.
 */
export function WallScreen({ slot, position = [0, 0, 0] }: WallScreenProps) {
  const mount = useCallback(
    (node: HTMLDivElement | null) => {
      slot(node);
      if (!node) return;
      // react-three-fiber connects its events to the wrapper div around the
      // canvas, and that is where OrbitControls listens — so input over this
      // document bubbles into the camera controls, which preventDefault() it.
      // That costs the two things that make this a document rather than a
      // picture: the wheel scrolls the camera instead of the page, and a
      // mousedown never focuses the field under it. Stopping these at the
      // screen keeps them on the page. Deliberately not preventDefault — the
      // browser still has to scroll, focus and select.
      const keep = (event: Event) => event.stopPropagation();
      for (const name of SWALLOW) node.addEventListener(name, keep, { passive: false });
      return () => {
        for (const name of SWALLOW) node.removeEventListener(name, keep);
        slot(null);
      };
    },
    [slot],
  );

  return (
    <group position={position}>
      {/* bezel */}
      <mesh position={[0, 0, -0.08]} castShadow>
        <boxGeometry args={[WORLD_W + 0.36, WORLD_H + 0.36, 0.16]} />
        <meshStandardMaterial color="#0a0f18" metalness={0.8} roughness={0.34} />
      </mesh>
      {/* glass behind the DOM, so the screen reads as off where content is
          transparent rather than showing the wall through it */}
      <mesh position={[0, 0, -0.005]}>
        <planeGeometry args={[WORLD_W, WORLD_H]} />
        <meshBasicMaterial color="#04070c" toneMapped={false} />
      </mesh>
      {/* a light strip under it, like every other fixture on this floor */}
      <mesh position={[0, -(WORLD_H / 2) - 0.26, 0.02]}>
        <planeGeometry args={[WORLD_W, 0.035]} />
        <meshBasicMaterial color="#00e5ff" toneMapped={false} />
      </mesh>

      {/* A rim around the glass, so the screen has an edge instead of ending
          in the dark. Horizontal bars run the full bezel width; the vertical
          pair stops short of them so the corners meet rather than cross. */}
      {[1, -1].map((side) => (
        <mesh key={`h${side}`} position={[0, side * (WORLD_H / 2 + 0.08), 0.015]}>
          <planeGeometry args={[WORLD_W + 0.32, 0.03]} />
          <meshBasicMaterial color="#39d8ff" toneMapped={false} />
        </mesh>
      ))}
      {[1, -1].map((side) => (
        <mesh key={`v${side}`} position={[side * (WORLD_W / 2 + 0.08), 0, 0.015]}>
          <planeGeometry args={[0.03, WORLD_H + 0.13]} />
          <meshBasicMaterial color="#39d8ff" toneMapped={false} />
        </mesh>
      ))}

      {/* The screen lights the room it is in. `<Html>` is DOM and emits
          nothing, so without these the wall around a bright document stays
          black and the screen reads as floating in a void rather than
          hanging on a wall. The near light is the halo on the wall; the far
          one is the spill that reaches the floor and the side walls. */}
      <pointLight position={[0, 0.4, 2.2]} intensity={26} distance={11} decay={2} color="#8ad8ff" />
      <pointLight position={[0, 1.2, 7]} intensity={34} distance={22} decay={2} color="#5f86c8" />

      <Html
        transform
        distanceFactor={FACTOR}
        position={[0, 0, 0.02]}
        pointerEvents="auto"
        zIndexRange={[10, 0]}
        style={{ width: PX_W, height: PX_H }}
      >
        <div ref={mount} className="kairox-screen" />
      </Html>
    </group>
  );
}
