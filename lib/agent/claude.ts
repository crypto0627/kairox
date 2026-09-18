import Anthropic from "@anthropic-ai/sdk";
import type { AgentProvider, Verdict, VerdictRequest } from "./types";
import { VERDICT_SCHEMA, normaliseVerdict } from "./types";
import { SYSTEM_PROMPT, buildUserPrompt } from "./prompt";

/** Opus unless told otherwise. Downgrading for cost is the operator's call,
 *  and AGENT_MODEL is where they make it. */
const DEFAULT_MODEL = "claude-opus-4-8";

/**
 * Hosted provider.
 *
 * Shares the system prompt, the user prompt and — the part that matters — the
 * same VERDICT_SCHEMA that constrains the local model. Structured output goes
 * through the raw `json_schema` form rather than the zod helper precisely so
 * there is one schema in the codebase: two definitions would drift, and the
 * whole reason for developing against a local model is being able to compare
 * the two on identical input.
 *
 * Not the default. AGENT_PROVIDER has to name it explicitly, because a
 * provider that bills per call should never be what you get by forgetting to
 * set something.
 */
export function createClaudeProvider(): AgentProvider {
  const model = process.env.AGENT_MODEL ?? DEFAULT_MODEL;
  const client = new Anthropic();

  return {
    id: "claude",
    model,

    async analyse(request: VerdictRequest): Promise<Verdict> {
      let response;
      try {
        response = await client.messages.create({
          model,
          // Generous ceiling rather than a tuned one: the verdict itself is a
          // couple of hundred tokens, but adaptive thinking draws from the
          // same budget and a truncated response costs a whole retry.
          max_tokens: 8000,
          system: SYSTEM_PROMPT,
          thinking: { type: "adaptive" },
          output_config: {
            format: { type: "json_schema", schema: VERDICT_SCHEMA },
          },
          messages: [{ role: "user", content: buildUserPrompt(request) }],
        });
      } catch (error) {
        // Separate the retryable from the misconfigured — the caller turns
        // any throw into a 503, and "agent unavailable" is a much less useful
        // thing to read than "your key is wrong".
        if (error instanceof Anthropic.AuthenticationError) {
          throw new Error("Anthropic rejected the credentials (check ANTHROPIC_API_KEY)");
        }
        if (error instanceof Anthropic.RateLimitError) {
          throw new Error("Anthropic rate limit reached; the floor will try again next cycle");
        }
        throw error;
      }

      // With thinking on, the response carries thinking blocks too; the
      // verdict is the text one.
      const text = response.content.find((block) => block.type === "text");
      if (!text || text.type !== "text") {
        throw new Error(`no text block in response (stop_reason: ${response.stop_reason})`);
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(text.text);
      } catch {
        throw new Error(`claude returned unparseable content: ${text.text.slice(0, 200)}`);
      }

      // Normalised on the same path as the local model. A schema-constrained
      // response should not need it, but the database constraint is the thing
      // that must hold, not our confidence in the provider.
      return normaliseVerdict(parsed);
    },
  };
}
