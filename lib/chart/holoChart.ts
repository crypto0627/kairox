import * as echarts from "echarts/core";
import { CandlestickChart } from "echarts/charts";
import { GridComponent, MarkLineComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { Candle, FeedStatus, Quote, SymbolSpec } from "@/lib/market/types";

echarts.use([CandlestickChart, GridComponent, MarkLineComponent, CanvasRenderer]);

type Chart = ReturnType<typeof echarts.init>;

/** Texture size. Power-of-two-ish and 1.6:1, matching the panel mesh. */
export const PANEL_W = 768;
export const PANEL_H = 480;

/** Where the ECharts plot sits inside the composite. */
const PLOT = { x: 8, y: 112, w: 752, h: 340 };

/**
 * Bars shown at once. A panel is only ~220 screen px wide at the dashboard
 * camera, so a long window would collapse into a grey smear. Forty bars keep
 * roughly 6 on-screen pixels each.
 */
const MAX_BARS = 40;

/* --- Palette -------------------------------------------------------------
 * Taken from the app's own @theme tokens so the panels, the HUD and the
 * robot visors agree.
 *
 * UP/DOWN sit above the dark-mode lightness band a conventional dashboard
 * would use. That is deliberate: darkening the green to enter the band drops
 * its deuteranope separation from DOWN to ΔE 2.9 — unreadable for a red-green
 * colourblind viewer — where this pair scores 14.2. Contrast against the
 * panel surface passes either way, and "too bright on near-black" is the
 * neon look this scene is built around. Direction is never carried by colour
 * alone: the header ships a ▲/▼ glyph and a signed number beside it.
 */
const UP = "#00e5b0";
const DOWN = "#ff2e88";
const CYAN = "#00e5ff";
const INK = "#d7f5ff";
const INK_DIM = "#7d99a8";
const AMBER = "#fbbf24";

const FONT_DISPLAY = '"DIN Alternate", "Bahnschrift", "Avenir Next Condensed", system-ui, sans-serif';
const FONT_MONO = '"SF Mono", Menlo, Consolas, ui-monospace, monospace';

const STATUS_LABEL: Record<FeedStatus, { text: string; colour: string }> = {
  open: { text: "LIVE", colour: CYAN },
  connecting: { text: "CONNECTING", colour: INK_DIM },
  reconnecting: { text: "RECONNECTING", colour: DOWN },
  simulated: { text: "SIMULATED", colour: AMBER },
  "closed-market": { text: "MARKET CLOSED", colour: INK_DIM },
  closed: { text: "OFFLINE", colour: INK_DIM },
};

/** Round a raw axis step up to the nearest 1, 2 or 5 times a power of ten. */
function niceStep(raw: number): number {
  if (!(raw > 0) || !Number.isFinite(raw)) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalised = raw / magnitude;
  const snapped = normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10;
  return snapped * magnitude;
}

export interface HoloChart {
  /** The texture source. Repainted only when the chart repaints. */
  readonly canvas: HTMLCanvasElement;
  /** Fires after every repaint, so the caller can flag the texture dirty. */
  onPaint(cb: () => void): void;
  update(candles: Candle[], quote: Quote | undefined, status: FeedStatus): void;
  dispose(): void;
}

/**
 * One holo panel: an ECharts candlestick rendered off-screen, composited
 * under a hand-drawn cyberpunk chrome onto a second canvas that Three.js
 * uses as a CanvasTexture.
 *
 * Two canvases rather than one because ECharts owns every pixel of the canvas
 * it renders into — anything drawn on top would be wiped on its next pass.
 */
export function createHoloChart(spec: SymbolSpec): HoloChart {
  const canvas = document.createElement("canvas");
  canvas.width = PANEL_W;
  canvas.height = PANEL_H;
  const ctx = canvas.getContext("2d");

  // Detached container: ECharts never needs it in the document because the
  // size is passed explicitly rather than measured.
  const host = document.createElement("div");
  host.style.width = `${PLOT.w}px`;
  host.style.height = `${PLOT.h}px`;

  const chart: Chart = echarts.init(host, null, {
    renderer: "canvas",
    width: PLOT.w,
    height: PLOT.h,
    devicePixelRatio: 1,
  });

  /**
   * ECharts does not create its canvas at init() time on a detached
   * container — it appears during the first setOption. Resolving this once
   * up front captures null forever, so look it up lazily and cache the hit.
   */
  let plotCanvas: HTMLCanvasElement | null = null;
  const plotSurface = () =>
    (plotCanvas ??= host.querySelector<HTMLCanvasElement>("canvas"));

  let painted: (() => void) | null = null;
  let last: { candles: Candle[]; quote?: Quote; status: FeedStatus } = {
    candles: [],
    status: "connecting",
  };

  function composite() {
    if (!ctx) return;
    const { candles, quote, status } = last;

    ctx.clearRect(0, 0, PANEL_W, PANEL_H);

    // --- panel ground: translucent, so the room shows through the glass ---
    const bg = ctx.createLinearGradient(0, 0, 0, PANEL_H);
    bg.addColorStop(0, "rgba(9, 16, 30, 0.90)");
    bg.addColorStop(1, "rgba(5, 7, 14, 0.82)");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, PANEL_W, PANEL_H);

    // --- the plot, drawn before the chrome so the chrome stays on top ---
    const surface = plotSurface();
    if (candles.length >= 2 && surface) {
      ctx.drawImage(surface, PLOT.x, PLOT.y);
    } else {
      // Each branch names a different cause. Collapsing them would let a
      // broken plot masquerade as "no data yet", which is what it did once.
      ctx.fillStyle = INK_DIM;
      ctx.font = `20px ${FONT_MONO}`;
      ctx.textAlign = "center";
      ctx.fillText(
        candles.length === 0
          ? "AWAITING FIRST TICK"
          : candles.length < 2
            ? "BUILDING FIRST BARS"
            : "PLOT UNAVAILABLE",
        PANEL_W / 2,
        PLOT.y + PLOT.h / 2,
      );
      ctx.textAlign = "left";
    }

    // --- header ---
    const hasPrice = (quote?.price ?? 0) > 0;
    const up = (quote?.changePct ?? 0) >= 0;
    const trend = up ? UP : DOWN;

    ctx.textBaseline = "alphabetic";
    ctx.letterSpacing = "5px";
    ctx.fillStyle = INK;
    ctx.font = `30px ${FONT_DISPLAY}`;
    ctx.fillText(spec.label.toUpperCase(), 24, 46);
    const labelW = ctx.measureText(spec.label.toUpperCase()).width;
    ctx.letterSpacing = "0px";

    if (spec.proxyNote) {
      ctx.fillStyle = "rgba(125, 153, 168, 0.75)";
      ctx.font = `15px ${FONT_MONO}`;
      ctx.fillText(spec.proxyNote, 30 + labelW, 46);
    }

    // price, right-aligned
    ctx.textAlign = "right";
    ctx.fillStyle = hasPrice ? INK : INK_DIM;
    ctx.font = `34px ${FONT_MONO}`;
    ctx.fillText(
      hasPrice
        ? quote!.price.toLocaleString("en-US", {
            minimumFractionDigits: spec.precision,
            maximumFractionDigits: spec.precision,
          })
        : "———",
      PANEL_W - 24,
      48,
    );

    // change: glyph + signed number, so direction never rests on colour alone
    if (hasPrice) {
      ctx.fillStyle = trend;
      ctx.font = `21px ${FONT_MONO}`;
      ctx.fillText(
        `${up ? "▲" : "▼"} ${Math.abs(quote!.changePct).toFixed(2)}%`,
        PANEL_W - 24,
        80,
      );
    }
    ctx.textAlign = "left";

    // status chip
    const st = STATUS_LABEL[status] ?? STATUS_LABEL.connecting;
    ctx.beginPath();
    ctx.arc(29, 74, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = st.colour;
    ctx.fill();
    ctx.letterSpacing = "3px";
    ctx.font = `14px ${FONT_MONO}`;
    ctx.fillStyle = st.colour;
    ctx.fillText(st.text, 42, 79);
    ctx.letterSpacing = "0px";

    // header rule
    ctx.strokeStyle = "rgba(0, 229, 255, 0.28)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(24, 100.5);
    ctx.lineTo(PANEL_W - 24, 100.5);
    ctx.stroke();

    // --- footer ---
    ctx.fillStyle = "rgba(125, 153, 168, 0.65)";
    ctx.font = `14px ${FONT_MONO}`;
    ctx.fillText(`${Math.min(candles.length, MAX_BARS)} bars · 1m`, 24, PANEL_H - 14);
    ctx.textAlign = "right";
    ctx.fillText(spec.currency, PANEL_W - 24, PANEL_H - 14);
    ctx.textAlign = "left";

    // --- chrome: scanlines, frame, corner brackets ---
    ctx.fillStyle = "rgba(0, 229, 255, 0.035)";
    for (let y = 0; y < PANEL_H; y += 4) ctx.fillRect(0, y, PANEL_W, 1);

    ctx.strokeStyle = "rgba(0, 229, 255, 0.38)";
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, PANEL_W - 2, PANEL_H - 2);

    ctx.strokeStyle = CYAN;
    ctx.lineWidth = 3;
    const arm = 26;
    for (const [cx, cy, sx, sy] of [
      [6, 6, 1, 1],
      [PANEL_W - 6, 6, -1, 1],
      [6, PANEL_H - 6, 1, -1],
      [PANEL_W - 6, PANEL_H - 6, -1, -1],
    ] as const) {
      ctx.beginPath();
      ctx.moveTo(cx + sx * arm, cy);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx, cy + sy * arm);
      ctx.stroke();
    }

    painted?.();
  }

  chart.on("rendered", composite);

  return {
    canvas,
    onPaint(cb) {
      painted = cb;
    },

    update(candles, quote, status) {
      last = { candles, quote, status };

      const bars = candles.slice(-MAX_BARS);
      if (bars.length < 2) {
        // Nothing worth plotting yet — repaint the chrome so the status chip
        // and the price still track, and skip ECharts entirely.
        composite();
        return;
      }

      // A dead-flat market collapses the auto-scaled axis onto a single
      // value, and every gridline then prints the same number. Hold the axis
      // open to a minimum span so the labels stay distinct and the candles
      // keep believable proportions.
      const mid =
        (Math.min(...bars.map((b) => b.l)) + Math.max(...bars.map((b) => b.h))) / 2;
      const natural = Math.max(...bars.map((b) => b.h)) - Math.min(...bars.map((b) => b.l));
      const span = Math.max(natural, Math.abs(mid) * 0.0008);
      // Snap the bounds outward to a round step so the gridlines carry whole
      // numbers instead of whatever the padding happened to produce.
      const step = Math.max(niceStep((span * 1.28) / 3), 10 ** -spec.precision);
      const lo = Math.floor((mid - span / 2) / step) * step;
      const hi = Math.ceil((mid + span / 2) / step) * step;

      chart.setOption(
        {
          animation: false,
          backgroundColor: "transparent",
          grid: { left: 10, right: 92, top: 10, bottom: 10 },
          xAxis: {
            type: "category",
            data: bars.map((c) => c.t),
            boundaryGap: true,
            axisLine: { lineStyle: { color: "rgba(125, 153, 168, 0.3)", width: 1 } },
            axisTick: { show: false },
            axisLabel: { show: false },
            splitLine: { show: false },
          },
          yAxis: {
            min: lo,
            max: hi,
            interval: step,
            position: "right",
            axisLine: { show: false },
            axisTick: { show: false },
            axisLabel: {
              color: INK_DIM,
              fontFamily: FONT_MONO,
              fontSize: 17,
              margin: 10,
              formatter: (v: number) =>
                v.toLocaleString("en-US", {
                  minimumFractionDigits: spec.precision,
                  maximumFractionDigits: spec.precision,
                }),
            },
            // Solid hairlines one shade off the surface — a grid should
            // recede, and dashes read as a threshold that isn't there.
            splitLine: {
              show: true,
              lineStyle: { color: "rgba(125, 153, 168, 0.13)", width: 1, type: "solid" },
            },
          },
          series: [
            {
              type: "candlestick",
              // ECharts wants [open, close, low, high] in that order.
              data: bars.map((c) => [c.o, c.c, c.l, c.h]),
              barMaxWidth: 18,
              itemStyle: {
                color: UP,
                color0: DOWN,
                borderColor: UP,
                borderColor0: DOWN,
                borderWidth: 1,
              },
              // One selective direct mark: the last close. The number itself
              // lives in the header, so the line carries no label.
              markLine: {
                symbol: "none",
                silent: true,
                animation: false,
                label: { show: false },
                lineStyle: {
                  color: quote && quote.changePct < 0 ? DOWN : UP,
                  width: 1,
                  type: "solid",
                  opacity: 0.55,
                },
                data: [{ yAxis: bars[bars.length - 1].c }],
              },
            },
          ],
        },
        { lazyUpdate: false },
      );
    },

    dispose() {
      painted = null;
      chart.off("rendered", composite);
      chart.dispose();
    },
  };
}
