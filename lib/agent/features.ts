import type { Candle } from "@/lib/market/types";

export interface WindowFeatures {
  first: number;
  last: number;
  high: number;
  low: number;
  /** Change across the whole window, percent. */
  changePct: number;
  /** Change across the most recent third, percent. */
  recentPct: number;
  /** Mean absolute bar-to-bar move, percent. The unit the window move is
   *  measured in — 3% means nothing until you know a bar usually moves 0.05%. */
  typicalBarPct: number;
  /** changePct expressed in typical bars. */
  moveInBars: number;
  /**
   * moveInBars divided by what a random walk of this length would drift
   * anyway (√n). 1.0 is the *mean* drift of pure noise, not its ceiling —
   * the distribution has a long tail and readings up to about 1.5 turn up by
   * chance all the time, which is why the prompt only calls a direction above
   * that.
   *
   * This replaces a threshold picked by feel. Forty bars of pure noise drift
   * about six typical bars, so the first rule here — "three typical bars is a
   * direction" — was calling coin flips trends.
   */
  trendStrength: number;
  upBars: number;
  totalBars: number;
  /**
   * How well the close agrees with the move's own direction: 1 means it
   * finished at the extreme it was heading for, 0 means it gave the move back.
   *
   * Direction-aware on purpose. Raw range position made the model read a
   * downtrend closing at its low as weakness — it called the move decisive in
   * its headline and then answered "flat".
   */
  consistency: number;
}

/**
 * Arithmetic the model should not be doing.
 *
 * An 8B model handed forty comma-separated closes and asked for a trend
 * answers "no clear direction" to a clean 3% climb — it pattern-matches a
 * hedge instead of reading the series. Computing the features here and asking
 * only for the judgment is the difference between a useless agent and a
 * working one, and it costs a dozen lines of exact arithmetic.
 */
export function windowFeatures(bars: Candle[]): WindowFeatures {
  const closes = bars.map((b) => b.c);
  const first = closes[0];
  const last = closes[closes.length - 1];
  const high = Math.max(...bars.map((b) => b.h));
  const low = Math.min(...bars.map((b) => b.l));

  let moves = 0;
  let upBars = 0;
  for (let i = 1; i < closes.length; i++) {
    const delta = (closes[i] - closes[i - 1]) / closes[i - 1];
    moves += Math.abs(delta);
    if (delta > 0) upBars++;
  }
  const typicalBarPct = closes.length > 1 ? (moves / (closes.length - 1)) * 100 : 0;
  const changePct = first ? ((last - first) / first) * 100 : 0;

  const tail = closes.slice(-Math.max(2, Math.round(closes.length / 3)));
  const recentPct = tail[0] ? ((last - tail[0]) / tail[0]) * 100 : 0;

  const totalBars = closes.length - 1;
  const moveInBars = typicalBarPct > 0 ? Math.abs(changePct) / typicalBarPct : 0;
  const rangePosition = high > low ? (last - low) / (high - low) : 0.5;

  return {
    first,
    last,
    high,
    low,
    changePct,
    recentPct,
    typicalBarPct,
    moveInBars,
    trendStrength: totalBars > 0 ? moveInBars / Math.sqrt(totalBars) : 0,
    upBars,
    totalBars,
    consistency: changePct >= 0 ? rangePosition : 1 - rangePosition,
  };
}
