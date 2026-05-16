import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { OAuthCredentials, OAuthLoginCallbacks } from "@earendil-works/pi-ai";
import { readFileSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";

function getGrokAuthToken(): string | null {
  const authPath = join(homedir(), ".grok", "auth.json");
  if (existsSync(authPath)) {
    try {
      const data = JSON.parse(readFileSync(authPath, "utf8"));
      return data.access_token || data.token || null;
    } catch {
      return null;
    }
  }
  return null;
}

export default function (pi: ExtensionAPI) {
  pi.registerProvider("xai-oauth", {
    name: "xAI (OAuth)",
    baseUrl: "https://api.x.ai/v1",
    api: "openai-responses",
    authHeader: true,

    oauth: {
      name: "xAI (Grok)",

      async login(callbacks: OAuthLoginCallbacks): Promise<OAuthCredentials> {
        // Check for existing Grok auth file first
        const existingToken = getGrokAuthToken();
        if (existingToken) {
          const useExisting = await callbacks.onPrompt({
            message: "Found existing Grok auth. Use it? (y/n)"
          });
          if (useExisting.toLowerCase().startsWith("y")) {
            return {
              refresh: "",
              access: existingToken,
              expires: Date.now() + 1000 * 60 * 60 * 24 * 30,
            };
          }
        }

        // Start device code flow
        const deviceResponse = await fetch("https://api.x.ai/oauth/device/code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ client_id: "pi-xai-oauth" }),
        });

        if (!deviceResponse.ok) {
          // Fallback to manual key entry
          const accessToken = await callbacks.onPrompt({
            message: "Device flow unavailable. Paste your xAI API key:",
          });
          return {
            refresh: "",
            access: accessToken.trim(),
            expires: Date.now() + 1000 * 60 * 60 * 24 * 365,
          };
        }

        const deviceData = await deviceResponse.json();

        callbacks.onDeviceCode({
          userCode: deviceData.user_code,
          verificationUri: deviceData.verification_uri,
        });

        // Poll for token
        const tokenResponse = await fetch("https://api.x.ai/oauth/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            grant_type: "urn:ietf:params:oauth:grant-type:device_code",
            device_code: deviceData.device_code,
            client_id: "pi-xai-oauth",
          }),
        });

        const tokenData = await tokenResponse.json();

        return {
          refresh: tokenData.refresh_token || "",
          access: tokenData.access_token,
          expires: Date.now() + (tokenData.expires_in || 3600) * 1000,
        };
      },

      async refreshToken(credentials: OAuthCredentials): Promise<OAuthCredentials> {
        if (!credentials.refresh) return credentials;

        const response = await fetch("https://api.x.ai/oauth/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            grant_type: "refresh_token",
            refresh_token: credentials.refresh,
            client_id: "pi-xai-oauth",
          }),
        });

        const data = await response.json();

        return {
          refresh: data.refresh_token || credentials.refresh,
          access: data.access_token,
          expires: Date.now() + (data.expires_in || 3600) * 1000,
        };
      },

      getApiKey(credentials: OAuthCredentials): string {
        return credentials.access;
      },
    },

    models: [
      {
        id: "grok-3",
        name: "Grok 3",
        reasoning: true,
        input: ["text", "image"],
        contextWindow: 131072,
        maxTokens: 16384,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        thinkingLevelMap: {
          minimal: null,
          low: "low",
          medium: "medium",
          high: "high",
          xhigh: "high",
        },
      },
      {
        id: "grok-3-mini",
        name: "Grok 3 Mini",
        reasoning: true,
        input: ["text", "image"],
        contextWindow: 131072,
        maxTokens: 16384,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        thinkingLevelMap: {
          minimal: null,
          low: "low",
          medium: "medium",
          high: "high",
          xhigh: "high",
        },
      },
      {
        id: "grok-4",
        name: "Grok 4",
        reasoning: true,
        input: ["text", "image"],
        contextWindow: 262144,
        maxTokens: 16384,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        thinkingLevelMap: {
          minimal: null,
          low: "low",
          medium: "medium",
          high: "high",
          xhigh: "high",
        },
      },
      {
        id: "grok-4.3",
        name: "Grok 4.3",
        reasoning: true,
        input: ["text", "image"],
        contextWindow: 1000000,
        maxTokens: 32768,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        thinkingLevelMap: {
          minimal: null,
          low: "low",
          medium: "medium",
          high: "high",
          xhigh: "high",
        },
      },
    ],
  });
}
