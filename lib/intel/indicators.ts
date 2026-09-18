/**
 * Indicators computed here rather than fetched.
 *
 * Every "free indicator API" either wants a key or returns numbers you cannot
 * check. Binance gives daily candles for nothing, and MACD and RSI are twenty
 * lines each — so the panel shows arithmetic this repository can be held to
 * rather than a figure it was handed.
 */

export interface DailyBar {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

/** Exponential moving average over a series, returned for every index. */
export function ema(values: number[], period: number): number[] {
  if (!values.length) return [];
  const k = 2 / (period + 1);
  const out: number[] = [values[0]];
  for (let i = 1; i < values.length; i++) {
    out.push(values[i] * k + out[i - 1] * (1 - k));
  }
  return out;
}

export interface Macd {
  macd: number;
  signal: number;
  histogram: number;
  /** The last few histogram bars, oldest first, for the panel's sparkline. */
  history: number[];
}

/** Standard 12/26/9. */
export function macd(closes: number[], fast = 12, slow = 26, signalPeriod = 9): Macd | null {
  if (closes.length < slow + signalPeriod) return null;
  const fastLine = ema(closes, fast);
  const slowLine = ema(closes, slow);
  const line = fastLine.map((v, i) => v - slowLine[i]);
  const signalLine = ema(line, signalPeriod);
  const histogram = line.map((v, i) => v - signalLine[i]);

  return {
    macd: line[line.length - 1],
    signal: signalLine[signalLine.length - 1],
    histogram: histogram[histogram.length - 1],
    history: histogram.slice(-32),
  };
}

export interface Rsi {
  value: number;
  history: number[];
}

/**
 * Wilder's RSI, which is the one every chart package means by "RSI 14" — a
 * smoothed average rather than a simple one over the window.
 */
export function rsi(closes: number[], period = 14): Rsi | null {
  if (closes.length < period + 1) return null;

  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const delta = closes[i] - closes[i - 1];
    if (delta >= 0) gain += delta;
    else loss -= delta;
  }
  gain /= period;
  loss /= period;

  const series: number[] = [];
  const push = () => {
    // A window with no losses is RSI 100 by definition, not a division by zero.
    series.push(loss === 0 ? 100 : 100 - 100 / (1 + gain / loss));
  };
  push();

  for (let i = period + 1; i < closes.length; i++) {
    const delta = closes[i] - closes[i - 1];
    gain = (gain * (period - 1) + Math.max(0, delta)) / period;
    loss = (loss * (period - 1) + Math.max(0, -delta)) / period;
    push();
  }

  return { value: series[series.length - 1], history: series.slice(-32) };
}

export interface VolumeRead {
  latest: number;
  /** Mean of the preceding 20 sessions, so "heavy" has a reference. */
  average20: number;
  ratio: number;
  history: number[];
}

export function volume(bars: DailyBar[]): VolumeRead | null {
  if (bars.length < 21) return null;
  const volumes = bars.map((b) => b.v);
  const latest = volumes[volumes.length - 1];
  const window = volumes.slice(-21, -1);
  const average20 = window.reduce((a, b) => a + b, 0) / window.length;
  return {
    latest,
    average20,
    ratio: average20 > 0 ? latest / average20 : 0,
    history: volumes.slice(-32),
  };
}
