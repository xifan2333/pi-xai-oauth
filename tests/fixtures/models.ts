import type { Model, Api } from "@earendil-works/pi-ai";

export const TEST_MODEL = {
  id: "grok-4.5",
  name: "Grok 4.5",
  provider: "xai-auth",
  api: "xai-responses",
  baseUrl: "https://cli-chat-proxy.grok.com/v1",
  headers: {},
  reasoning: true,
  input: ["text", "image"],
  cost: { input: 2, output: 6, cacheRead: 0.5, cacheWrite: 0 },
  contextWindow: 500_000,
  maxTokens: 131_072,
} as unknown as Model<Api>;

/** Create a model-registry context returning one OAuth bearer. */
export function authContext(model: any = TEST_MODEL, token = "oauth-token") {
  return {
    model,
    modelRegistry: {
      find(provider: string, id: string) {
        return { ...model, provider, id };
      },
      async getApiKeyAndHeaders() {
        return { ok: true, apiKey: token };
      },
    },
  };
}
