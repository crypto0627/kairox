"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { CanvasTexture, Mesh, MeshBasicMaterial } from "three";
import { agentOf, useAgentStore } from "@/lib/store/agentStore";
import { SYMBOL_BY_ID } from "@/lib/market/symbols";
import {
  PANEL_H,
  PANEL_W,
  createVerdictTexture,
  drawVerdictPanel,
} from "@/lib/three/verdictPanel";

/** Redraw rate while the pulse is animating. Sixty uploads a second for a
 *  blinking underline would be absurd; eight reads the same. */
const PULSE_HZ = 8;

export interface VerdictHoloProps {
  symbolId: string;
  width?: number;
  position?: [number, number, number];
}

/**
 * The speech panel above a trader's console.
 *
 * Built and driven imperatively, like every other live surface in this scene:
 * a verdict landing repaints one canvas and flags one texture, and never
 * re-renders the 3D tree.
 */
export function VerdictHolo({
  symbolId,
  width = 2.15,
  position = [0, 2.45, -0.45],
}: VerdictHoloProps) {
  const mesh = useRef<Mesh>(null);
  const material = useRef<MeshBasicMaterial>(null);
  const gfx = useRef<{ canvas: HTMLCanvasElement; texture: CanvasTexture } | null>(null);
  const lastPulse = useRef(0);

  useEffect(() => {
    const created = createVerdictTexture();
    gfx.current = created;

    const surface = material.current;
    if (surface) {
      surface.map = created.texture;
      surface.needsUpdate = true;
    }

    const label = SYMBOL_BY_ID.get(symbolId)?.label ?? symbolId;
    const repaint = () => {
      const agent = agentOf(useAgentStore.getState().agents, symbolId);
      drawVerdictPanel(created.canvas, agent, label, performance.now() / 1000);
      created.texture.needsUpdate = true;
      // A standing agent has nothing to say; it should not hang a blank
      // panel over an empty console.
      if (mesh.current) {
        mesh.current.visible = agent.phase !== "idle" && agent.phase !== "standby";
      }
    };

    repaint();
    const unsubscribe = useAgentStore.subscribe(repaint);

    return () => {
      unsubscribe();
      gfx.current = null;
      if (surface) {
        surface.map = null;
        surface.needsUpdate = true;
      }
      created.texture.dispose();
    };
  }, [symbolId]);

  useFrame(({ clock }) => {
    const created = gfx.current;
    if (!created) return;

    // Only the thinking state animates. Everything else is repainted by the
    // store subscription, so a settled panel costs nothing per frame.
    const agent = agentOf(useAgentStore.getState().agents, symbolId);
    if (agent.phase !== "thinking") return;

    const now = clock.elapsedTime;
    if (now - lastPulse.current < 1 / PULSE_HZ) return;
    lastPulse.current = now;

    const label = SYMBOL_BY_ID.get(symbolId)?.label ?? symbolId;
    drawVerdictPanel(created.canvas, agent, label, now);
    created.texture.needsUpdate = true;
  });

  const height = width * (PANEL_H / PANEL_W);

  return (
    <mesh ref={mesh} position={position} visible={false}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial ref={material} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  );
}
