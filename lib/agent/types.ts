import type { Candle, FeedStatus, Quote, SymbolSpec } from "@/lib/market/types";

export type Stance = "long" | "short" | "flat";

/** What an agent returns when asked about its instrument. */
export interface Verdict {
  stance: Stance;
  /** 0..1. Models routinely answer 0..100 here; normalise before trusting it. */
  confidence: number;
  /** One line, shown on the holo panel above the trader's console. */
  headline: string;
  reasoning: string;
  risk: string;
}

/** Everything the agent is allowed to see. */
export interface VerdictRequest {
  spec: SymbolSpec;
  bars: Candle[];
  quote: Quote;
  status: FeedStatus;
  /** Trading persona, from the Profile page. Steers tone and risk appetite. */
  persona?: string;
}

export interface VerdictResult extends Verdict {
  provider: string;
  model: string;
  latencyMs: number;
}

/** One schema-constrained completion. The provider knows nothing about what
 *  the call is for. */
export interface CompletionRequest {
  system: string;
  user: string;
  /** JSON Schema the response is constrained to. Shaped for the Anthropic
   *  SDK's json_schema field, which Ollama's `format` accepts unchanged. */
  schema: Record<string, unknown>;
  maxTokens?: number;
}

/**
 * A provider is a transport, not a task.
 *
 * It used to expose `analyse` directly, which meant a second kind of call —
 * the desk report — would have had to add a second method to every provider.
 * Both tasks constrain a schema-shaped completion; only the prompt and the
 * schema differ, so that is all that lives above this line.
 */
export interface AgentProvider {
  readonly id: string;
  readonly model: string;
  complete(request: CompletionRequest): Promise<unknown>;
}

/** The JSON shape both providers constrain their output to. */
export const VERDICT_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  properties: {
    stance: { type: "string", enum: ["long", "short", "flat"] },
    confidence: {
      type: "number",
      minimum: 0,
      maximum: 1,
      description: "Between 0 and 1. Not a percentage.",
    },
    headline: { type: "string", description: "One sentence, at most 90 characters." },
    reasoning: { type: "string", description: "Two or three sentences." },
    risk: { type: "string", description: "The single thing that would break this call." },
  },
  required: ["stance", "confidence", "headline", "reasoning", "risk"],
};

/**
 * Coerce whatever came back into a Verdict that the database will accept.
 *
 * Small local models are loose with the contract: an 8B model asked for a
 * 0..1 confidence answers `60` about half the time, and long headlines
 * overflow the holo panel. Everything here is a real failure observed while
 * testing against llama3.1:8b, not defensive decoration.
 */
export function normaliseVerdict(raw: unknown): Verdict {
  const value = (raw ?? {}) as Record<string, unknown>;

  const stanceRaw = String(value.stance ?? "flat").toLowerCase().trim();
  const stance: Stance =
    stanceRaw === "long" || stanceRaw === "short" ? stanceRaw : "flat";

  let confidence = Number(value.confidence);
  if (!Number.isFinite(confidence)) confidence = 0.5;
  // A model that answers 60 means 60%, not 6000%.
  if (confidence > 1) confidence = confidence / 100;
  confidence = Math.min(1, Math.max(0, confidence));

  const text = (input: unknown, fallback: string, limit: number) => {
    const s = typeof input === "string" ? input.trim() : "";
    if (!s) return fallback;
    return s.length > limit ? `${s.slice(0, limit - 1).trimEnd()}…` : s;
  };

  return {
    stance,
    confidence,
    headline: text(value.headline, "No call.", 90),
    reasoning: text(value.reasoning, "No reasoning returned.", 600),
    risk: text(value.risk, "", 200),
  };
}
