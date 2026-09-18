import type { Candle, Tick } from "./types";

export interface Snapshot {
  price: number;
  volume: number;
  ts: number;
  candle: Candle;
}

const CANDLE_MS = 60_000;

/**
 * Write buffer, not a debounce.
 *
 * Sockets push far faster than the 5s display cadence — Binance @ticker is
 * ~1/s and a liquid ETF can fire dozens of trades a second. Every tick
 * overwrites the buffer and folds into the in-progress candle; a single
 * timer for the whole app flushes it in one store write.
 */
export class TickBuffer {
  private pending = new Map<string, Snapshot>();
  private open = new Map<string, Candle>();
  private timer: number | undefined;

  constructor(
    private readonly flushMs: number,
    private readonly onFlush: (batch: Map<string, Snapshot>) => void,
  ) {}

  push(tick: Tick) {
    const bucket = Math.floor(tick.ts / CANDLE_MS) * CANDLE_MS;
    let candle = this.open.get(tick.symbolId);

    if (!candle || candle.t !== bucket) {
      candle = { t: bucket, o: tick.price, h: tick.price, l: tick.price, c: tick.price, v: 0 };
      this.open.set(tick.symbolId, candle);
    }

    candle.h = Math.max(candle.h, tick.price);
    candle.l = Math.min(candle.l, tick.price);
    candle.c = tick.price;
    candle.v += tick.volume ?? 0;

    this.pending.set(tick.symbolId, {
      price: tick.price,
      volume: tick.volume ?? 0,
      ts: tick.ts,
      candle: { ...candle },
    });
  }

  start() {
    if (this.timer !== undefined) return;
    this.timer = window.setInterval(() => this.flush(), this.flushMs);
  }

  stop() {
    window.clearInterval(this.timer);
    this.timer = undefined;
  }

  flush() {
    if (this.pending.size === 0) return;
    const batch = this.pending;
    this.pending = new Map();
    this.onFlush(batch);
  }
}
