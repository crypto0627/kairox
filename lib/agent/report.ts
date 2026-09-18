import type { Candle, FeedStatus, Quote, SymbolSpec } from "@/lib/market/types";
import type { Stance } from "./types";
import { windowFeatures } from "./features";

export interface DeskReport {
  headline: string;
  summary: string;
  agreement: string;
  watch: string[];
  caveat: string;
}

export interface ReportInstrument {
  spec: SymbolSpec;
  bars: Candle[];
  quote: Quote;
  status: FeedStatus;
  /** The agent's most recent call, if it has been asked. */
  verdict?: { stance: Stance; confidence: number; headline: string; decidedAt: string };
  /** Resolved accuracy, if anything of this agent's has been graded. */
  accuracy?: { hits: number; resolved: number } | null;
}

export const REPORT_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  properties: {
    headline: {
      type: "string",
      description:
        "One sentence, at most 100 characters, stating the floor's main " +
        "finding. Never a title, a date, or the words 'desk report'.",
    },
    summary: { type: "string", description: "Three to five sentences on what the floor saw." },
    agreement: {
      type: "string",
      description: "Where the agents line up and where they conflict. Two or three sentences.",
    },
    watch: {
      type: "array",
      minItems: 2,
      maxItems: 4,
      items: { type: "string" },
      description: "Short, concrete things to watch next.",
    },
    caveat: {
      type: "string",
      description: "The single most important limitation of this report.",
    },
  },
  required: ["headline", "summary", "agreement", "watch", "caveat"],
};

export const REPORT_SYSTEM = `You are the supervisor of a five-agent trading floor. \
Each agent watches one instrument and reports only on that one. You are the only \
one who sees all five at once, so your job is the part none of them can do: \
what the instruments are doing together, and where the agents contradict each other.

You are given measurements that have already been computed. Trust them and cite \
them by their numbers.

Rules:
- Say what the cross-instrument picture is. Anything that only concerns one \
instrument has already been said by its own agent.
- Name disagreements explicitly, including an agent whose call conflicts with \
its own instrument's measurements.
- An agent with a poor resolved accuracy deserves less weight, and say so when \
it matters.
- "caveat" is not a disclaimer to pad the report. Name the thing that would \
most mislead a reader — usually that some feeds are simulated, or that the \
window is only forty minutes, or that most agents have not been asked yet.
- Never attribute a call to an agent listed as not asked. An agent that has \
not been asked has no opinion to agree or disagree with, and saying otherwise \
is the one mistake that makes the whole report untrustworthy.
- "headline" states what you found. It is not a title and never contains a date.
- Never invent news, fundamentals, or price levels you were not given.`;

/** Trend strength above which the supervisor should treat a move as real.
 *  Same threshold the agents use, for the same reason. */
const NOISE_LINE = 1.5;

export function buildReportPrompt(instruments: ReportInstrument[]): string {
  const lines = instruments.map((item) => {
    const f = windowFeatures(item.bars);
    const dp = item.spec.precision;
    const direction = f.changePct >= 0 ? "up" : "down";

    // The asked/not-asked fact goes in the heading, and an unasked agent gets
    // no verdict line at all. Stating it as one field among many let the model
    // write "BTC's agent has not been asked" two sentences after quoting
    // BTC's call.
    const head = item.verdict
      ? `${item.spec.label}  [AGENT ASKED]`
      : `${item.spec.label}  [AGENT NOT ASKED — it has no opinion, do not give it one]`;

    const opinion = item.verdict
      ? `  agent's call         ${item.verdict.stance.toUpperCase()} at ${item.verdict.confidence.toFixed(2)} — "${item.verdict.headline}"
  agent's record        ${
    item.accuracy && item.accuracy.resolved > 0
      ? `${item.accuracy.hits} of ${item.accuracy.resolved} resolved`
      : "nothing resolved yet"
  }`
      : "";

    return `${head}${item.spec.proxyNote ? `  (${item.spec.proxyNote})` : ""}
  feed                  ${item.status}
  last                  ${item.quote.price.toFixed(dp)}   session ${item.quote.changePct >= 0 ? "+" : ""}${item.quote.changePct.toFixed(2)}%
  window change         ${f.changePct >= 0 ? "+" : ""}${f.changePct.toFixed(2)}%  (${direction})
  trend strength        ${f.trendStrength.toFixed(2)}   ${f.trendStrength < NOISE_LINE ? "(noise)" : "(a direction)"}
  consistency           ${(f.consistency * 100).toFixed(0)}%${opinion ? `\n${opinion}` : ""}`;
  });

  const simulated = instruments.filter((i) => i.status === "simulated").map((i) => i.spec.label);
  const unasked = instruments.filter((i) => !i.verdict).map((i) => i.spec.label);

  return `THE FLOOR, ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC
Window: the last ${instruments[0]?.bars.length ?? 0} one-minute bars.

${lines.join("\n\n")}

${simulated.length ? `SIMULATED FEEDS: ${simulated.join(", ")}. These are not live market data.` : "All feeds are live."}
${unasked.length ? `AGENTS WITH NO OPINION: ${unasked.join(", ")}. Do not describe a call for any of these.` : "Every agent has reported."}

Write the desk report.`;
}

/** Coerce the response into something the column constraints will accept. */
export function normaliseReport(raw: unknown): DeskReport {
  const value = (raw ?? {}) as Record<string, unknown>;
  const text = (input: unknown, fallback: string, limit: number) => {
    const s = typeof input === "string" ? input.trim() : "";
    if (!s) return fallback;
    return s.length > limit ? `${s.slice(0, limit - 1).trimEnd()}…` : s;
  };

  const watchRaw = Array.isArray(value.watch) ? value.watch : [];
  const watch = watchRaw
    .map((entry) => text(entry, "", 160))
    .filter(Boolean)
    .slice(0, 4);

  return {
    headline: text(value.headline, "No report.", 120),
    summary: text(value.summary, "", 1200),
    agreement: text(value.agreement, "", 800),
    watch: watch.length ? watch : ["Nothing specific flagged."],
    caveat: text(value.caveat, "", 400),
  };
}
