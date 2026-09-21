"use client";

import { useEffect, useRef } from "react";
import type { CanvasTexture, MeshBasicMaterial } from "three";
import {
  createPanel,
  drawEtf,
  drawIndicators,
  drawNews,
  drawSentiment,
  H,
  W,
} from "@/lib/three/intelPanels";

/** Sources publish daily; the route caches, and this asks again occasionally. */
const REFRESH_MS = 5 * 60_000;

const PANEL_W = 5.6;
const PANEL_H = PANEL_W * (H / W);
const GAP_X = 0.3;
const GAP_Y = 0.26;

type Slot = "etf" | "sentiment" | "indicators" | "news";
const SLOTS: Array<{ id: Slot; x: number; y: number }> = [
  { id: "etf", x: -1, y: 1 },
  { id: "sentiment", x: 1, y: 1 },
  { id: "indicators", x: -1, y: -1 },
  { id: "news", x: 1, y: -1 },
];

interface Snapshot {
  etf: Parameters<typeof drawEtf>[1];
  sentiment: Parameters<typeof drawSentiment>[1];
  close: number | null;
  macd: Parameters<typeof drawIndicators>[1]["macd"];
  rsi: Parameters<typeof drawIndicators>[1]["rsi"];
  volume: Parameters<typeof drawIndicators>[1]["volume"];
  headlines: Parameters<typeof drawNews>[1];
}

/**
 * The wall.
 *
 * Four canvas panels: ETF creations and redemptions, the sentiment index,
 * daily MACD/RSI/volume computed in this repository, and the wire. Built and
 * painted imperatively like every other live surface here — the data arrives
 * every five minutes and a refresh costs four repaints and four texture
 * uploads, never a React render inside the 3D tree.
 */
export function IntelWall() {
  const materials = useRef<Partial<Record<Slot, MeshBasicMaterial | null>>>({});

  useEffect(() => {
    // Captured once: React has already assigned the material refs by the time
    // an effect runs, and cleanup must release the same objects it claimed.
    const surfaces = materials.current;
    const panels = new Map<Slot, { canvas: HTMLCanvasElement; texture: CanvasTexture }>();
    for (const slot of SLOTS) {
      const panel = createPanel();
      panels.set(slot.id, panel);
      const material = surfaces[slot.id];
      if (material) {
        material.map = panel.texture;
        material.needsUpdate = true;
      }
    }

    let live = true;

    const paint = (data: Snapshot | null) => {
      const etf = panels.get("etf");
      const sentiment = panels.get("sentiment");
      const indicators = panels.get("indicators");
      const news = panels.get("news");
      if (etf) drawEtf(etf.canvas, data?.etf ?? null);
      if (sentiment) drawSentiment(sentiment.canvas, data?.sentiment ?? null);
      if (indicators) {
        drawIndicators(indicators.canvas, {
          close: data?.close ?? null,
          macd: data?.macd ?? null,
          rsi: data?.rsi ?? null,
          volume: data?.volume ?? null,
        });
      }
      if (news) drawNews(news.canvas, data?.headlines ?? null);
      for (const panel of panels.values()) panel.texture.needsUpdate = true;
    };

    // Paint the empty state first: a wall that is blank while a fetch is in
    // flight looks broken, and one that says so does not.
    paint(null);

    const load = async () => {
      try {
        const response = await fetch("/api/intel");
        if (!response.ok) throw new Error(String(response.status));
        const data = (await response.json()) as Snapshot;
        if (live) paint(data);
      } catch {
        if (live) paint(null);
      }
    };

    void load();
    const timer = window.setInterval(() => void load(), REFRESH_MS);

    return () => {
      live = false;
      window.clearInterval(timer);
      for (const slot of SLOTS) {
        const material = surfaces[slot.id];
        if (material) {
          material.map = null;
          material.needsUpdate = true;
        }
      }
      for (const panel of panels.values()) panel.texture.dispose();
    };
  }, []);

  return (
    <group>
      {SLOTS.map((slot) => (
        <group
          key={slot.id}
          position={[
            slot.x * (PANEL_W + GAP_X) * 0.5,
            slot.y * (PANEL_H + GAP_Y) * 0.5,
            0,
          ]}
        >
          <mesh position={[0, 0, -0.02]}>
            <planeGeometry args={[PANEL_W + 0.1, PANEL_H + 0.1]} />
            <meshBasicMaterial color="#060a12" transparent opacity={0.7} depthWrite={false} />
          </mesh>
          <mesh>
            <planeGeometry args={[PANEL_W, PANEL_H]} />
            <meshBasicMaterial
              ref={(material) => {
                materials.current[slot.id] = material;
              }}
              transparent
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}
