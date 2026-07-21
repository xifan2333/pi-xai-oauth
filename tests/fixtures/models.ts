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

export const BUILTIN_XAI_TEST_MODEL = {
  ...TEST_MODEL,
  provider: "xai",
  api: "openai-responses",
  baseUrl: "https://api.x.ai/v1",
} as unknown as Model<Api>;

/** Create a model-registry context returning one tagged credential. */
export function authContext(
  model: any = TEST_MODEL,
  token = "oauth-token",
  credentialType: "oauth" | "api_key" = "oauth",
) {
  const storedCredential = credentialType === "oauth"
    ? { type: "oauth", access: token, refresh: "refresh", expires: Date.now() + 60_000 }
    : { type: "api_key", key: token };
  return {
    model,
    modelRegistry: {
      authStorage: {
        get(provider: string) {
          return provider === model.provider ? storedCredential : undefined;
        },
      },
      find(provider: string, id: string) {
        return provider === model.provider ? { ...model, provider, id } : undefined;
      },
      isUsingOAuth(registryModel: any) {
        return registryModel?.provider === model.provider && credentialType === "oauth";
      },
      getProviderAuthStatus(provider: string) {
        return provider === model.provider
          ? { configured: true, source: "stored" }
          : { configured: false };
      },
      async getApiKeyAndHeaders() {
        return { ok: true, apiKey: token };
      },
    },
  };
}
