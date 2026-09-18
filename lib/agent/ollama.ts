import type { AgentProvider, CompletionRequest } from "./types";

const DEFAULT_HOST = "http://127.0.0.1:11434";
const DEFAULT_MODEL = "llama3.1:8b";

/**
 * Local provider, for development.
 *
 * Ollama takes a JSON schema in `format` and constrains decoding to it, so the
 * response parses — but the schema is the only thing it guarantees. Bounds,
 * lengths and units remain advisory, which is why every caller normalises
 * what comes back rather than trusting it into a database column.
 */
export function createOllamaProvider(): AgentProvider {
  const host = process.env.OLLAMA_HOST ?? DEFAULT_HOST;
  const model = process.env.OLLAMA_MODEL ?? DEFAULT_MODEL;

  return {
    id: "ollama",
    model,

    async complete(request: CompletionRequest): Promise<unknown> {
      const response = await fetch(`${host}/api/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model,
          stream: false,
          format: request.schema,
          messages: [
            { role: "system", content: request.system },
            { role: "user", content: request.user },
          ],
          options: {
            temperature: 0.3,
            // Bounded on purpose: an 8B model left unbounded will write an
            // essay into whatever free-text field it finds.
            num_predict: request.maxTokens ?? 400,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`ollama ${response.status}: ${await response.text()}`);
      }

      const body = (await response.json()) as { message?: { content?: string } };
      const content = body.message?.content ?? "";
      try {
        return JSON.parse(content);
      } catch {
        throw new Error(`ollama returned unparseable content: ${content.slice(0, 200)}`);
      }
    },
  };
}
