import type { AgentProvider, Verdict, VerdictRequest } from "./types";
import { VERDICT_SCHEMA, normaliseVerdict } from "./types";
import { SYSTEM_PROMPT, buildUserPrompt } from "./prompt";

const DEFAULT_HOST = "http://127.0.0.1:11434";
const DEFAULT_MODEL = "llama3.1:8b";

interface ChatResponse {
  message?: { content?: string };
  total_duration?: number;
}

/**
 * Local provider, for development.
 *
 * Ollama takes a JSON schema in `format` and constrains decoding to it, so the
 * response parses — but the schema is the only thing it guarantees. Bounds,
 * lengths and units are still advisory, which is why every response goes
 * through normaliseVerdict rather than straight into the database.
 */
export function createOllamaProvider(): AgentProvider {
  const host = process.env.OLLAMA_HOST ?? DEFAULT_HOST;
  const model = process.env.OLLAMA_MODEL ?? DEFAULT_MODEL;

  return {
    id: "ollama",
    model,

    async analyse(request: VerdictRequest): Promise<Verdict> {
      const response = await fetch(`${host}/api/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model,
          stream: false,
          format: VERDICT_SCHEMA,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: buildUserPrompt(request) },
          ],
          options: {
            temperature: 0.3,
            // Enough for the five fields and no more; an 8B model left
            // unbounded will happily write an essay into `reasoning`.
            num_predict: 400,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`ollama ${response.status}: ${await response.text()}`);
      }

      const body = (await response.json()) as ChatResponse;
      const content = body.message?.content ?? "";

      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch {
        throw new Error(`ollama returned unparseable content: ${content.slice(0, 200)}`);
      }

      return normaliseVerdict(parsed);
    },
  };
}
