import { CanvasTexture, SRGBColorSpace } from "three";

export const W = 1024;
export const H = 640;

const DISPLAY = '"DIN Alternate", "Bahnschrift", "Avenir Next Condensed", system-ui, sans-serif';
const MONO = '"SF Mono", Menlo, Consolas, ui-monospace, monospace';

const INK = "#d7f5ff";
const DIM = "#7d99a8";
const UP = "#00e5b0";
const DOWN = "#ff2e88";
const CYAN = "#00e5ff";
const AMBER = "#ffb347";

export function createPanel(): { canvas: HTMLCanvasElement; texture: CanvasTexture } {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return { canvas, texture };
}

/** Shared chrome: ground, frame, title. Returns the plot area. */
function shell(ctx: CanvasRenderingContext2D, title: string, subtitle: string) {
  ctx.clearRect(0, 0, W, H);
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "rgba(9, 16, 30, 0.96)");
  bg.addColorStop(1, "rgba(5, 8, 15, 0.93)");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.letterSpacing = "9px";
  ctx.font = `46px ${DISPLAY}`;
  ctx.fillStyle = INK;
  ctx.fillText(title.toUpperCase(), 36, 70);
  ctx.letterSpacing = "0px";

  ctx.font = `25px ${MONO}`;
  ctx.fillStyle = DIM;
  ctx.fillText(subtitle, 36, 106);

  ctx.strokeStyle = "rgba(0, 229, 255, 0.3)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(36, 128.5);
  ctx.lineTo(W - 36, 128.5);
  ctx.stroke();

  ctx.strokeStyle = "rgba(0, 229, 255, 0.34)";
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, W - 3, H - 3);

  return { x: 44, y: 162, w: W - 88, h: H - 246 };
}

function unavailable(ctx: CanvasRenderingContext2D, why: string) {
  ctx.font = `30px ${MONO}`;
  ctx.fillStyle = AMBER;
  ctx.textAlign = "center";
  ctx.fillText(why, W / 2, H / 2);
  ctx.textAlign = "left";
}

const money = (n: number) => {
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${n < 0 ? "-" : ""}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${n < 0 ? "-" : ""}$${(abs / 1e6).toFixed(0)}M`;
  return `${n < 0 ? "-" : ""}$${(abs / 1e3).toFixed(0)}K`;
};

export interface EtfDay {
  date: string;
  netInflow: number;
  cumulative: number;
}

/**
 * Daily net creations and redemptions.
 *
 * A diverging bar chart because that is what the data is: above and below a
 * zero line, where the sign is the whole story. Only the latest bar is
 * labelled — a number over every bar is chaos and goes unread.
 */
export function drawEtf(canvas: HTMLCanvasElement, days: EtfDay[] | null) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const latest = days?.[days.length - 1];
  const plot = shell(
    ctx,
    "BTC ETF flow",
    latest ? `US spot · net ${money(latest.netInflow)} on ${latest.date}` : "US spot ETFs",
  );
  if (!days?.length) return unavailable(ctx, "flow data unavailable");

  const peak = Math.max(...days.map((d) => Math.abs(d.netInflow)), 1);
  const zero = plot.y + plot.h / 2;
  const barW = plot.w / days.length;

  // Zero line, solid and one shade off the ground. Dashes would read as a
  // threshold, and this is an axis.
  ctx.strokeStyle = "rgba(125, 153, 168, 0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(plot.x, zero + 0.5);
  ctx.lineTo(plot.x + plot.w, zero + 0.5);
  ctx.stroke();

  days.forEach((day, i) => {
    const height = (Math.abs(day.netInflow) / peak) * (plot.h / 2 - 8);
    ctx.fillStyle = day.netInflow >= 0 ? UP : DOWN;
    ctx.globalAlpha = i === days.length - 1 ? 1 : 0.72;
    ctx.fillRect(
      plot.x + i * barW + 1.5,
      day.netInflow >= 0 ? zero - height : zero,
      Math.max(2, barW - 3),
      height,
    );
  });
  ctx.globalAlpha = 1;

  ctx.font = `22px ${MONO}`;
  ctx.fillStyle = DIM;
  ctx.fillText(days[0].date, plot.x, plot.y + plot.h + 36);
  ctx.textAlign = "right";
  ctx.fillText(`${days.length} sessions · cum ${money(latest!.cumulative)}`, plot.x + plot.w, plot.y + plot.h + 36);
  ctx.textAlign = "left";
}

export interface Sentiment {
  value: number;
  label: string;
  history: number[];
}

/** The index as a dial, with its word beside it — never the colour alone. */
export function drawSentiment(canvas: HTMLCanvasElement, s: Sentiment | null) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const plot = shell(ctx, "Fear & Greed", s ? `today · ${s.label}` : "crypto sentiment");
  if (!s) return unavailable(ctx, "sentiment unavailable");

  const cx = plot.x + 172;
  const cy = plot.y + 168;
  const radius = 124;
  const start = Math.PI * 0.75;
  const sweep = Math.PI * 1.5;

  ctx.lineWidth = 27;
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(125, 153, 168, 0.18)";
  ctx.beginPath();
  ctx.arc(cx, cy, radius, start, start + sweep);
  ctx.stroke();

  // Fear reads magenta, greed green — the same pair the whole floor uses for
  // down and up, so the association is already learned.
  const tint = s.value < 45 ? DOWN : s.value > 55 ? UP : AMBER;
  ctx.strokeStyle = tint;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, start, start + sweep * (s.value / 100));
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.font = `92px ${DISPLAY}`;
  ctx.fillStyle = INK;
  ctx.fillText(String(s.value), cx, cy + 20);
  ctx.font = `26px ${MONO}`;
  ctx.fillStyle = tint;
  ctx.fillText(s.label.toUpperCase(), cx, cy + 60);
  ctx.textAlign = "left";

  // Thirty days beside it, so today has somewhere to sit.
  const hx = plot.x + 390;
  const hw = plot.w - 390;
  const hy = plot.y + 66;
  const hh = 172;
  ctx.strokeStyle = "rgba(125, 153, 168, 0.22)";
  ctx.lineWidth = 1;
  for (const level of [25, 50, 75]) {
    const y = hy + hh - (level / 100) * hh;
    ctx.beginPath();
    ctx.moveTo(hx, y + 0.5);
    ctx.lineTo(hx + hw, y + 0.5);
    ctx.stroke();
  }
  ctx.strokeStyle = CYAN;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  s.history.forEach((value, i) => {
    const x = hx + (i / Math.max(1, s.history.length - 1)) * hw;
    const y = hy + hh - (value / 100) * hh;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.font = `21px ${MONO}`;
  ctx.fillStyle = DIM;
  ctx.fillText(`${s.history.length} days`, hx, hy + hh + 34);
}

export interface Indicators {
  close: number | null;
  macd: { macd: number; signal: number; histogram: number; history: number[] } | null;
  rsi: { value: number; history: number[] } | null;
  volume: { latest: number; average20: number; ratio: number } | null;
}

/** MACD, RSI and volume — all computed in this repository, from daily candles. */
export function drawIndicators(canvas: HTMLCanvasElement, d: Indicators) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const plot = shell(
    ctx,
    "BTC daily",
    d.close ? `close ${d.close.toLocaleString("en-US", { maximumFractionDigits: 0 })} · computed here` : "daily indicators",
  );
  if (!d.macd || !d.rsi || !d.volume) return unavailable(ctx, "not enough daily history");

  // MACD histogram
  ctx.font = `22px ${MONO}`;
  ctx.fillStyle = DIM;
  ctx.fillText("MACD 12/26/9", plot.x, plot.y + 6);

  const hx = plot.x;
  const hy = plot.y + 26;
  const hw = plot.w;
  const hh = 140;
  const zero = hy + hh / 2;
  const peak = Math.max(...d.macd.history.map(Math.abs), 1);
  const barW = hw / d.macd.history.length;

  ctx.strokeStyle = "rgba(125, 153, 168, 0.3)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(hx, zero + 0.5);
  ctx.lineTo(hx + hw, zero + 0.5);
  ctx.stroke();

  d.macd.history.forEach((value, i) => {
    const height = (Math.abs(value) / peak) * (hh / 2 - 4);
    ctx.fillStyle = value >= 0 ? UP : DOWN;
    ctx.fillRect(hx + i * barW + 1, value >= 0 ? zero - height : zero, Math.max(2, barW - 2), height);
  });

  ctx.font = `24px ${MONO}`;
  ctx.fillStyle = d.macd.histogram >= 0 ? UP : DOWN;
  ctx.textAlign = "right";
  ctx.fillText(
    `${d.macd.histogram >= 0 ? "+" : ""}${d.macd.histogram.toFixed(0)}`,
    hx + hw,
    hy + hh + 32,
  );
  ctx.textAlign = "left";

  // RSI as a band, because 30 and 70 are the only numbers anyone reads it for
  const ry = hy + hh + 74;
  ctx.font = `22px ${MONO}`;
  ctx.fillStyle = DIM;
  ctx.fillText("RSI 14", plot.x, ry);

  const barY = ry + 20;
  const barH = 34;
  ctx.fillStyle = "rgba(125, 153, 168, 0.16)";
  ctx.fillRect(plot.x, barY, plot.w, barH);
  ctx.fillStyle = "rgba(255, 46, 136, 0.14)";
  ctx.fillRect(plot.x, barY, plot.w * 0.3, barH);
  ctx.fillStyle = "rgba(0, 229, 176, 0.14)";
  ctx.fillRect(plot.x + plot.w * 0.7, barY, plot.w * 0.3, barH);

  const marker = plot.x + (d.rsi.value / 100) * plot.w;
  ctx.fillStyle = d.rsi.value > 70 ? UP : d.rsi.value < 30 ? DOWN : CYAN;
  ctx.fillRect(marker - 2, barY - 5, 4, barH + 10);
  ctx.font = `25px ${MONO}`;
  ctx.fillStyle = INK;
  ctx.fillText(d.rsi.value.toFixed(1), Math.min(marker + 14, plot.x + plot.w - 78), barY + 25);

  // Volume against its own 20-day average
  const vy = barY + barH + 56;
  ctx.font = `22px ${MONO}`;
  ctx.fillStyle = DIM;
  ctx.fillText("Volume vs 20d average", plot.x, vy);
  ctx.font = `44px ${DISPLAY}`;
  ctx.fillStyle = d.volume.ratio >= 1 ? UP : DIM;
  ctx.fillText(`${d.volume.ratio.toFixed(2)}×`, plot.x, vy + 48);
  ctx.font = `21px ${MONO}`;
  ctx.fillStyle = DIM;
  ctx.fillText(
    `${d.volume.latest.toFixed(0)} BTC today · ${d.volume.average20.toFixed(0)} avg`,
    plot.x + 160,
    vy + 44,
  );
}

export interface NewsItem {
  headline: string;
  source: string;
  at: number;
}

export function drawNews(canvas: HTMLCanvasElement, items: NewsItem[] | null) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const plot = shell(ctx, "Wire", items?.length ? `${items.length} stories` : "crypto headlines");
  if (!items?.length) return unavailable(ctx, "wire unavailable");

  let y = plot.y + 22;
  for (const item of items.slice(0, 4)) {
    const time = new Date(item.at).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });

    ctx.font = `21px ${MONO}`;
    ctx.fillStyle = CYAN;
    ctx.fillText(time, plot.x, y);
    ctx.fillStyle = DIM;
    ctx.fillText(item.source.slice(0, 20), plot.x + 84, y);

    ctx.font = `30px ${DISPLAY}`;
    ctx.fillStyle = INK;
    // One line each; a wall panel is not the place to read a paragraph.
    let text = item.headline;
    while (text.length > 4 && ctx.measureText(text).width > plot.w) {
      text = text.slice(0, -2);
    }
    ctx.fillText(text === item.headline ? text : `${text}…`, plot.x, y + 38);

    y += 92;
  }
}
