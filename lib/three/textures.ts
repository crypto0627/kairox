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

/**
 * CJK on a canvas needs a stack that actually resolves. Latin fallbacks are
 * last so a machine without any of these still renders *something* rather
 * than tofu boxes.
 */
const CJK = '"PingFang TC", "PingFang SC", "Hiragino Sans GB", "Heiti TC", "Microsoft JhengHei", "Noto Sans CJK TC", sans-serif';

/**
 * What the skyline advertises.
 *
 * Real words rather than the pseudo-glyph bars this drew before. Night City's
 * loudest instrument is the corporate sign, and a sign nobody can read is
 * just texture — the moment it says 加密貨幣交易所 the building has a tenant
 * and the street has an economy.
 */
const BILLBOARDS: Array<[string, string]> = [
  ["加密貨幣交易所", "24H 全天候結算"],
  ["黃金交易所", "實物交割 · 保稅倉"],
  ["美聯儲", "利率決議 即時發布"],
  ["川普大樓", "頂層公寓 出售中"],
  ["期貨交易所", "槓桿 125 倍"],
  ["數據銀行", "記憶體託管"],
  ["義體診所", "神經連結 免預約"],
  ["量子運算中心", "算力出租"],
  ["合成食品", "蛋白質配給"],
  ["無人機配送", "十分鐘送達"],
];

/** Short enough to stack down a narrow column. */
const VERTICAL_SIGNS = [
  "黃金交易所",
  "加密貨幣",
  "美聯儲",
  "川普大樓",
  "義體診所",
  "數據銀行",
  "夜之城",
  "量子運算",
  "霓虹酒吧",
  "腦機介面",
];

function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Shrink until it fits; a sign that overflows its own board reads as a bug. */
function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  startPx: number,
): number {
  let size = startPx;
  ctx.font = `${size}px ${CJK}`;
  while (size > 10 && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    ctx.font = `${size}px ${CJK}`;
  }
  return size;
}

const adCache = new Map<number, Texture>();

/** A wide commercial panel: colour field, the tenant's name, a strapline. */
export function adTexture(variant: number): Texture {
  const cached = adCache.get(variant);
  if (cached) return cached;

  const random = seeded(0xad0000 + variant);
  const [ink, ground] = AD_SCHEMES[variant % AD_SCHEMES.length];
  const [name, strap] = BILLBOARDS[variant % BILLBOARDS.length];
  const W = 320;
  const H = 180;
  const [el, ctx] = canvas(W, H);

  ctx.fillStyle = ground;
  ctx.fillRect(0, 0, W, H);

  // headline band
  ctx.fillStyle = ink;
  ctx.globalAlpha = 0.9;
  ctx.fillRect(12, 20, W - 24, 78);
  ctx.globalAlpha = 1;

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = ground;
  const size = fitText(ctx, name, W - 44, 58);
  ctx.font = `${size}px ${CJK}`;
  ctx.fillText(name, W / 2, 60);

  ctx.fillStyle = ink;
  const strapSize = fitText(ctx, strap, W - 40, 30);
  ctx.font = `${strapSize}px ${CJK}`;
  ctx.fillText(strap, W / 2, 124);

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = ink;
  ctx.fillRect(18, 150, W - 36, 3);
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.arc(W - 34, 166, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  void random;

  const texture = new CanvasTexture(el);
  texture.colorSpace = SRGBColorSpace;
  adCache.set(variant, texture);
  return texture;
}

const stripCache = new Map<number, Texture>();

/**
 * A vertical sign, characters stacked down the column.
 *
 * Which is how these are actually written and hung, and it is the reason a
 * Chinese street reads as vertical stripes of light from a distance — the
 * thing pseudo-glyph bars could never produce.
 */
export function signStripTexture(variant: number): Texture {
  const cached = stripCache.get(variant);
  if (cached) return cached;

  const [ink, ground] = AD_SCHEMES[(variant + 2) % AD_SCHEMES.length];
  const text = VERTICAL_SIGNS[variant % VERTICAL_SIGNS.length];
  const CELL = 54;
  const W = 64;
  const H = Math.max(256, text.length * CELL + 24);
  const [el, ctx] = canvas(W, H);

  ctx.fillStyle = ground;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = ink;
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, W - 4, H - 4);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = ink;
  ctx.font = `${CELL - 12}px ${CJK}`;
  [...text].forEach((char, i) => {
    ctx.fillText(char, W / 2, 20 + i * CELL + CELL / 2);
  });
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

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

  // the sponsor, under the mark
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(0, 229, 255, 0.92)";
  ctx.font = `46px ${CJK}`;
  ctx.fillText("加密貨幣交易所", W / 2, 292);
  ctx.fillStyle = "rgba(255, 46, 136, 0.8)";
  ctx.font = `30px ${CJK}`;
  ctx.fillText("夜之城 · 二十四小時", W / 2, 342);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  // scanlines — the tell that it is projected
  ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
  for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 2);

  holoTexture = new CanvasTexture(el);
  holoTexture.colorSpace = SRGBColorSpace;
  holoTexture.wrapS = RepeatWrapping;
  holoTexture.wrapT = RepeatWrapping;
  return holoTexture;
}
