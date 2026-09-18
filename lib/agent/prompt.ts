import type { VerdictRequest } from "./types";

/**
 * The instructions both providers send.
 *
 * Shared on purpose: the point of running a local model in development is to
 * compare it against Claude later, and two providers with two prompts are not
 * comparable. Anything provider-specific belongs in the transport, not here.
 */
export const SYSTEM_PROMPT = `You are one of five autonomous trading agents on a monitoring floor. \
You watch exactly one instrument and report on it. You do not place orders.

Rules:
- Answer only about the instrument you are given. You cannot see the others.
- "confidence" is a number between 0 and 1. It is not a percentage.
- "headline" is one sentence, at most 90 characters, written for a wall display.
- "reasoning" is two or three sentences naming what in the data drove the call.
- "risk" names the single observation that would invalidate the call.
- A short window of one-minute bars supports a short-horizon read and nothing \
more. Say "flat" when the data does not support a direction; a low-confidence \
guess is worse than an honest abstention.
- Never invent news, fundamentals or anything outside the numbers you are given.`;

/** Compact numeric view of the window. Small models read a summary far better
 *  than forty raw rows, and it costs a fifth of the tokens. */
export function buildUserPrompt(request: VerdictRequest): string {
  const { spec, bars, quote, status, persona } = request;
  const dp = spec.precision;
  const fmt = (n: number) => n.toFixed(dp);

  const closes = bars.map((b) => b.c);
  const highs = bars.map((b) => b.h);
  const lows = bars.map((b) => b.l);
  const first = closes[0] ?? quote.price;
  const last = closes[closes.length - 1] ?? quote.price;
  const windowPct = first ? ((last - first) / first) * 100 : 0;

  const recent = bars
    .slice(-6)
    .map((b) => `  ${fmt(b.o)} ${fmt(b.h)} ${fmt(b.l)} ${fmt(b.c)}`)
    .join("\n");

  // The agent is told when its feed is synthetic. The rest of this app never
  // presents a simulated feed as real, and an agent that writes confident
  // analysis of a random walk without saying so would break that.
  const provenance =
    status === "simulated"
      ? `DATA PROVENANCE: this feed is SIMULATED, not live market data. Analyse the \
series as given, but say so in your headline and keep confidence at or below 0.4.`
      : `DATA PROVENANCE: live feed (${status}).`;

  const proxy = spec.proxyNote
    ? `\nNote: the instrument is tracked through a proxy (${spec.proxyNote}).`
    : "";

  return `INSTRUMENT: ${spec.label} (${spec.currency})${proxy}
${provenance}
${persona ? `YOUR MANDATE: ${persona}\n` : ""}
WINDOW: ${bars.length} one-minute bars
  open of window   ${fmt(first)}
  last             ${fmt(last)}
  change over window ${windowPct >= 0 ? "+" : ""}${windowPct.toFixed(2)}%
  window high      ${fmt(Math.max(...highs))}
  window low       ${fmt(Math.min(...lows))}
  session change   ${quote.changePct >= 0 ? "+" : ""}${quote.changePct.toFixed(2)}%

CLOSES (oldest to newest):
${closes.map((c) => fmt(c)).join(", ")}

LAST SIX BARS (open high low close):
${recent}

Give your verdict on ${spec.label} for the next 15 to 30 minutes.`;
}
