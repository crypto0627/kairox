"use client";

import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { CanvasTexture, SRGBColorSpace, type Mesh, type MeshBasicMaterial } from "three";
import { createHoloChart, PANEL_H, PANEL_W } from "@/lib/chart/holoChart";
import { SYMBOL_BY_ID } from "@/lib/market/symbols";
import { useMarketStore } from "@/lib/store/marketStore";

export interface HoloPanelProps {
  symbolId: string;
  /** World width; height follows the texture's 1.6:1 ratio. */
  width?: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
}

/**
 * One screen in the array: an ECharts candlestick living on a CanvasTexture.
 *
 * Everything here is imperative on purpose. The chart, the texture and the
 * store subscription are all outside React's render path, so a price flush
 * costs one canvas repaint and one texture upload — never a re-render of the
 * 3D tree. The mesh starts hidden and is revealed once the map is attached,
 * which avoids both a white first frame and a setState inside an effect.
 */
export function HoloPanel({
  symbolId,
  width = 3.05,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
}: HoloPanelProps) {
  const maxAnisotropy = useThree((s) => s.gl.capabilities.getMaxAnisotropy());
  const screen = useRef<Mesh>(null);
  const material = useRef<MeshBasicMaterial>(null);

  useEffect(() => {
    const spec = SYMBOL_BY_ID.get(symbolId);
    if (!spec) return;

    const chart = createHoloChart(spec);
    const texture = new CanvasTexture(chart.canvas);
    texture.colorSpace = SRGBColorSpace;
    // The panel is drawn far smaller than 768 px and at an angle, so mipmaps
    // and anisotropy are what keep the candles from shimmering. Both are
    // rebuilt once per flush, not per frame, which is cheap enough.
    texture.anisotropy = maxAnisotropy;
    chart.onPaint(() => {
      texture.needsUpdate = true;
    });

    const mat = material.current;
    const mesh = screen.current;
    if (mat) {
      mat.map = texture;
      mat.needsUpdate = true;
    }
    if (mesh) mesh.visible = true;

    const push = () => {
      const s = useMarketStore.getState();
      chart.update(
        s.candles[symbolId] ?? [],
        s.quotes[symbolId],
        s.status[symbolId] ?? "connecting",
      );
    };
    push();
    const unsubscribe = useMarketStore.subscribe(push);

    return () => {
      unsubscribe();
      if (mesh) mesh.visible = false;
      if (mat) {
        mat.map = null;
        mat.needsUpdate = true;
      }
      chart.dispose();
      texture.dispose();
    };
  }, [symbolId, maxAnisotropy]);

  const height = width * (PANEL_H / PANEL_W);

  return (
    <group position={position} rotation={rotation}>
      {/* bezel, a shade darker than the glass so the panel reads as an object */}
      <mesh position={[0, 0, -0.014]}>
        <planeGeometry args={[width + 0.09, height + 0.09]} />
        <meshBasicMaterial color="#060a12" transparent opacity={0.6} depthWrite={false} />
      </mesh>

      <mesh ref={screen} visible={false}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial
          ref={material}
          transparent
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {/* underglow rail — emissive, so Phase 5's Bloom has something to catch */}
      <mesh position={[0, -height / 2 - 0.06, 0]}>
        <planeGeometry args={[width * 0.96, 0.022]} />
        <meshBasicMaterial color="#00e5ff" toneMapped={false} />
      </mesh>
    </group>
  );
}
