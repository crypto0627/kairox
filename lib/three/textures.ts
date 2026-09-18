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
      ctx.globalAlpha = 0.22 + Math.random() * 0.5;
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

/* ------------------------------------------------------------------------ *
 * Signage
 *
 * Night City's loudest instrument is the advertisement: giant commercial
 * panels bolted to brutalist slabs, and vertical sign strips stacked down
 * every corner. None of it is legible at this distance and none of it should
 * be — what reads is density, colour and rhythm, so the "glyphs" here are
 * bars arranged like writing rather than any actual script.
 * ------------------------------------------------------------------------ */

/** Ad palettes: hot, saturated, and never the room's own cyan. */
const AD_SCHEMES: Array<[string, string]> = [
  ["#ff2e6b", "#1a0410"],
  ["#ff9b21", "#1a0d02"],
  ["#c04bff", "#120420"],
  ["#00d8ff", "#02141a"],
  ["#ffe14d", "#1a1502"],
];

/** Draws a block of pseudo-writing: strokes on a grid, never real glyphs. */
function drawGlyphs(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  cell: number,
  colour: string,
  random: () => number,
) {
  ctx.fillStyle = colour;
  for (let gy = y; gy + cell <= y + h; gy += cell) {
    for (let gx = x; gx + cell <= x + w; gx += cell) {
      const strokes = 2 + Math.floor(random() * 4);
      for (let i = 0; i < strokes; i++) {
        const thick = Math.max(1, cell * 0.14);
        if (random() < 0.5) {
          ctx.fillRect(gx + cell * 0.15, gy + cell * (0.2 + random() * 0.6), cell * 0.7, thick);
        } else {
          ctx.fillRect(gx + cell * (0.2 + random() * 0.6), gy + cell * 0.15, thick, cell * 0.7);
        }
      }
    }
  }
}

function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const adCache = new Map<number, Texture>();

/** A wide commercial panel: colour field, a headline band, a block of text. */
export function adTexture(variant: number): Texture {
  const cached = adCache.get(variant);
  if (cached) return cached;

  const random = seeded(0xad0000 + variant);
  const [ink, ground] = AD_SCHEMES[variant % AD_SCHEMES.length];
  const W = 256;
  const H = 160;
  const [el, ctx] = canvas(W, H);

  ctx.fillStyle = ground;
  ctx.fillRect(0, 0, W, H);

  // headline band
  ctx.fillStyle = ink;
  ctx.globalAlpha = 0.92;
  ctx.fillRect(14, 16, W - 28, 30);
  ctx.globalAlpha = 1;
  drawGlyphs(ctx, 22, 20, W - 44, 22, 22, ground, random);

  // body text
  drawGlyphs(ctx, 18, 62, W - 36, 56, 14, ink, random);

  // a rule and a mark, because every ad has a logo in the corner
  ctx.fillStyle = ink;
  ctx.fillRect(18, 128, W - 36, 2);
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.arc(W - 34, 142, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  const texture = new CanvasTexture(el);
  texture.colorSpace = SRGBColorSpace;
  adCache.set(variant, texture);
  return texture;
}

const stripCache = new Map<number, Texture>();

/** A vertical sign: glyphs stacked down a narrow column. */
export function signStripTexture(variant: number): Texture {
  const cached = stripCache.get(variant);
  if (cached) return cached;

  const random = seeded(0x51600 + variant);
  const [ink, ground] = AD_SCHEMES[(variant + 2) % AD_SCHEMES.length];
  const W = 48;
  const H = 256;
  const [el, ctx] = canvas(W, H);

  ctx.fillStyle = ground;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = ink;
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, W - 3, H - 3);
  drawGlyphs(ctx, 8, 10, W - 16, H - 20, 32, ink, random);

  const texture = new CanvasTexture(el);
  texture.colorSpace = SRGBColorSpace;
  stripCache.set(variant, texture);
  return texture;
}

let hazardTexture: Texture | null = null;

/** Diagonal hazard banding for floor markings — the Entropism half of the
 *  brief: this is a working floor, not a showroom. */
export function hazardStripeTexture(): Texture {
  if (hazardTexture) return hazardTexture;

  const SIZE = 64;
  const [el, ctx] = canvas(SIZE, SIZE);
  ctx.fillStyle = "#14161a";
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.strokeStyle = "#ffb347";
  ctx.lineWidth = 12;
  for (let i = -SIZE; i < SIZE * 2; i += 26) {
    ctx.beginPath();
    ctx.moveTo(i, -4);
    ctx.lineTo(i + SIZE + 8, SIZE + 4);
    ctx.stroke();
  }

  hazardTexture = new CanvasTexture(el);
  hazardTexture.colorSpace = SRGBColorSpace;
  hazardTexture.wrapS = RepeatWrapping;
  hazardTexture.wrapT = RepeatWrapping;
  return hazardTexture;
}

let puddleTexture: Texture | null = null;

/**
 * A soft radial falloff, used as a wet patch on the floor.
 *
 * Real reflections would want a second render pass per puddle. What actually
 * sells a rain-slicked floor is far cheaper: the neon around it, smeared and
 * additive, in roughly the shape of standing water.
 */
export function puddleGlowTexture(): Texture {
  if (puddleTexture) return puddleTexture;

  const SIZE = 128;
  const [el, ctx] = canvas(SIZE, SIZE);
  const g = ctx.createRadialGradient(SIZE / 2, SIZE / 2, 0, SIZE / 2, SIZE / 2, SIZE / 2);
  g.addColorStop(0, "rgba(255,255,255,0.85)");
  g.addColorStop(0.45, "rgba(255,255,255,0.28)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SIZE, SIZE);

  puddleTexture = new CanvasTexture(el);
  puddleTexture.colorSpace = SRGBColorSpace;
  return puddleTexture;
}

let holoTexture: Texture | null = null;

/**
 * The floating advertisement.
 *
 * Night City's most recognisable single object is a hologram the size of a
 * building, hanging between them and visible from half the map. This is its
 * silhouette: a bold mark, a text block, and the scanlines that say the thing
 * is projected rather than built. Drawn on transparent so it can be composited
 * additively against the skyline.
 */
export function holoAdTexture(): Texture {
  if (holoTexture) return holoTexture;

  const W = 256;
  const H = 384;
  const [el, ctx] = canvas(W, H);
  ctx.clearRect(0, 0, W, H);

  // the mark: concentric rings, cut through by a bar
  ctx.strokeStyle = "rgba(0, 229, 255, 0.85)";
  ctx.lineWidth = 9;
  for (const r of [92, 66, 40]) {
    ctx.beginPath();
    ctx.arc(W / 2, 150, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(255, 46, 136, 0.9)";
  ctx.fillRect(22, 132, W - 44, 34);

  // a block of pseudo-text under it
  ctx.fillStyle = "rgba(0, 229, 255, 0.7)";
  for (let row = 0; row < 7; row++) {
    const w = 70 + ((row * 53) % 120);
    ctx.fillRect((W - w) / 2, 268 + row * 15, w, 7);
  }

  // scanlines — the tell that it is projected
  ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
  for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 2);

  holoTexture = new CanvasTexture(el);
  holoTexture.colorSpace = SRGBColorSpace;
  holoTexture.wrapS = RepeatWrapping;
  holoTexture.wrapT = RepeatWrapping;
  return holoTexture;
}
