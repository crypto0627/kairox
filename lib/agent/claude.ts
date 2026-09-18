import Anthropic from "@anthropic-ai/sdk";
import type { AgentProvider, CompletionRequest } from "./types";

/** Opus unless told otherwise. Downgrading for cost is the operator's call,
 *  and AGENT_MODEL is where they make it. */
const DEFAULT_MODEL = "claude-opus-4-8";

/**
 * Hosted provider.
 *
 * Takes the same prompts and the same schemas as the local model. Structured
 * output goes through the raw `json_schema` form rather than the zod helper
 * precisely so there is one schema per task in the codebase: two definitions
 * would drift, and the whole reason for developing against a local model is
 * being able to compare the two on identical input.
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

    async complete(request: CompletionRequest): Promise<unknown> {
      let response;
      try {
        response = await client.messages.create({
          model,
          // Generous ceiling rather than a tuned one: the verdict itself is a
          // couple of hundred tokens, but adaptive thinking draws from the
          // same budget and a truncated response costs a whole retry.
          max_tokens: 8000,
          system: request.system,
          thinking: { type: "adaptive" },
          output_config: {
            format: { type: "json_schema", schema: request.schema },
          },
          messages: [{ role: "user", content: request.user }],
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

      try {
        return JSON.parse(text.text);
      } catch {
        throw new Error(`claude returned unparseable content: ${text.text.slice(0, 200)}`);
      }
    },
  };
}
