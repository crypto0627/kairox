import type { VerdictRequest } from "./types";
import { windowFeatures } from "./features";

/**
 * The instructions both providers send.
 *
 * Shared on purpose: the point of running a local model in development is to
 * compare it against Claude later, and two providers with two prompts are not
 * comparable. Anything provider-specific belongs in the transport, not here.
 */
export const SYSTEM_PROMPT = `You are one of five autonomous trading agents on a monitoring floor. \
You watch exactly one instrument and report on it. You do not place orders.

You are given measurements that have already been computed from the window. \
Trust them and reason from them; do not try to re-derive a trend by eye from \
the list of closes.

How to read the measurements:
- "trend strength" compares the window's move against what a purely random \
series of the same length drifts anyway. 1.0 is the average drift of pure \
noise, and readings up to about 1.5 happen by chance often. Below 1.5 treat \
the window as noise. Between 1.5 and 3.0 there is a direction. Above 3.0 it \
is decisive.
- "consistency" is already stated in the direction of the move: high means the \
move held to the end, low means it was given back. It never argues against the \
direction — a fall that closes at its low is a consistent fall.

How to answer:
- "stance" follows the direction of the move once trend strength clears 1.5. \
Call "flat" when it is below that.
- "confidence" is between 0 and 1, and it is not a percentage. A decisive, \
consistent move deserves 0.7 to 0.9. A clear but choppy one deserves 0.45 to \
0.7. Genuine noise deserves 0.15 to 0.3. Answering 0 for everything is not \
caution, it is refusing to do the job.
- "headline" is one sentence, at most 90 characters, written for a wall \
display. Name the actual move.
- "reasoning" is two or three sentences citing the measurements by their \
numbers.
- "risk" names the single observation that would invalidate the call.
- Never invent news, fundamentals or anything outside the numbers you are given.`;

/** Compact numeric view of the window. Small models read a summary far better
 *  than forty raw rows, and it costs a fifth of the tokens. */
export function buildUserPrompt(request: VerdictRequest): string {
  const { spec, bars, quote, status, persona } = request;
  const dp = spec.precision;
  const fmt = (n: number) => n.toFixed(dp);
  const f = windowFeatures(bars);

  const direction = f.changePct >= 0 ? "up" : "down";
  const recent = bars
    .slice(-6)
    .map((b) => `  ${fmt(b.o)} ${fmt(b.h)} ${fmt(b.l)} ${fmt(b.c)}`)
    .join("\n");

  // The agent is told when its feed is synthetic. The rest of this app never
  // presents a simulated feed as real, and an agent that writes confident
  // analysis of a random walk without saying so would break that.
  const provenance =
    status === "simulated"
      ? `DATA PROVENANCE: this feed is SIMULATED, not live market data. Read the \
measurements as given and call the move you see, but say "simulated" in your \
headline and keep confidence at or below 0.5.`
      : `DATA PROVENANCE: live feed (${status}).`;

  const proxy = spec.proxyNote
    ? `\nNote: the instrument is tracked through a proxy (${spec.proxyNote}).`
    : "";

  return `INSTRUMENT: ${spec.label} (${spec.currency})${proxy}
${provenance}
${persona ? `YOUR MANDATE: ${persona}\n` : ""}
MEASUREMENTS over ${bars.length} one-minute bars
  change over window        ${f.changePct >= 0 ? "+" : ""}${f.changePct.toFixed(2)}%  (${direction})
  change over last third    ${f.recentPct >= 0 ? "+" : ""}${f.recentPct.toFixed(2)}%
  typical single-bar move   ${f.typicalBarPct.toFixed(3)}%
  TREND STRENGTH            ${f.trendStrength.toFixed(2)}   (1.0 = average drift of pure noise; under 1.5 is noise)
  consistency of the ${direction} move   ${(f.consistency * 100).toFixed(0)}%
  bars closed up            ${f.upBars} of ${f.totalBars}

PRICES
  window open ${fmt(f.first)} · last ${fmt(f.last)} · high ${fmt(f.high)} · low ${fmt(f.low)}
  session change ${quote.changePct >= 0 ? "+" : ""}${quote.changePct.toFixed(2)}%

LAST SIX BARS (open high low close):
${recent}

Give your verdict on ${spec.label} for the next 15 to 30 minutes.`;
}
