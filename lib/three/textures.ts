import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Texture } from "three";

/**
 * Procedural textures for the room.
 *
 * Everything here is generated once and shared by every mesh that wants it —
 * they are immutable and live as long as the page, so there is nothing to
 * dispose and nothing for a StrictMode double-mount to duplicate.
 */

function canvas(w: number, h: number) {
  const el = document.createElement("canvas");
  el.width = w;
  el.height = h;
  return [el, el.getContext("2d")!] as const;
}

let windowTexture: Texture | null = null;

/**
 * One building's worth of lit windows: 4 columns by 8 rows on near-black.
 * Tiled vertically by the city's height classes so window rows stay roughly
 * square whatever the building's scale.
 */
export function cityWindowTexture(): Texture {
  if (windowTexture) return windowTexture;

  const CELL = 12;
  const COLS = 6;
  const ROWS = 12;
  const [el, ctx] = canvas(COLS * CELL, ROWS * CELL);

  ctx.fillStyle = "#04060b";
  ctx.fillRect(0, 0, el.width, el.height);

  // A night skyline is mostly dark. Roughly two in five windows are lit, and
  // the warm ones outnumber the cold to keep the city from reading as one
  // more neon surface competing with the room.
  const TINTS = ["#ffd9a0", "#ffc98a", "#bfe8ff", "#9fe0ff", "#ffb0d8"];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if (Math.random() > 0.42) continue;
      ctx.globalAlpha = 0.35 + Math.random() * 0.65;
      ctx.fillStyle = TINTS[(Math.random() * TINTS.length) | 0];
      ctx.fillRect(col * CELL + 3, row * CELL + 4, CELL - 6, CELL - 8);
    }
  }
  ctx.globalAlpha = 1;

  windowTexture = new CanvasTexture(el);
  windowTexture.colorSpace = SRGBColorSpace;
  windowTexture.wrapS = RepeatWrapping;
  windowTexture.wrapT = RepeatWrapping;
  return windowTexture;
}

let gridTexture: Texture | null = null;

/** A single grid cell: transparent with a hairline along two edges. */
export function floorGridTexture(): Texture {
  if (gridTexture) return gridTexture;

  const SIZE = 128;
  const [el, ctx] = canvas(SIZE, SIZE);

  ctx.clearRect(0, 0, SIZE, SIZE);
  ctx.strokeStyle = "rgba(0, 229, 255, 0.55)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 1);
  ctx.lineTo(SIZE, 1);
  ctx.moveTo(1, 0);
  ctx.lineTo(1, SIZE);
  ctx.stroke();

  // Brighter node where the lines cross, so the grid reads as a lattice
  // rather than as scanlines once it recedes toward the window.
  ctx.fillStyle = "rgba(0, 229, 255, 0.9)";
  ctx.fillRect(0, 0, 5, 5);

  gridTexture = new CanvasTexture(el);
  gridTexture.colorSpace = SRGBColorSpace;
  gridTexture.wrapS = RepeatWrapping;
  gridTexture.wrapT = RepeatWrapping;
  return gridTexture;
}

let skyTexture: Texture | null = null;

/**
 * Vertical gradient for the backdrop: light pollution pooling at the horizon,
 * fading to nothing overhead. Two pixels wide — the gradient only runs in y.
 */
export function nightSkyTexture(): Texture {
  if (skyTexture) return skyTexture;

  const [el, ctx] = canvas(2, 256);
  const g = ctx.createLinearGradient(0, 256, 0, 0);
  g.addColorStop(0, "#150c22");
  g.addColorStop(0.12, "#0c1228");
  g.addColorStop(0.42, "#070a16");
  g.addColorStop(1, "#04050a");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 2, 256);

  skyTexture = new CanvasTexture(el);
  skyTexture.colorSpace = SRGBColorSpace;
  return skyTexture;
}
