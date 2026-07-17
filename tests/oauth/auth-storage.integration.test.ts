import type { OAuthLoginCallbacks } from "@earendil-works/pi-ai";
import { describe, expect, it } from "vitest";
import { XAI_OAUTH_DEVICE_URL } from "../../extensions/xai/constants";
import {
  createXaiOAuth,
  XAI_DEVICE_LOGIN_METHOD,
} from "../../extensions/xai/oauth";
import {
  devicePayload,
  jsonResponse,
  makeClock,
  tokenPayload,
} from "../fixtures/device";

function oauthWithClock() {
  const clock = makeClock();
  return createXaiOAuth({
    getExistingCredentials: () => null,
    deviceAuth: {
      now: clock.now,
      sleep: clock.sleep,
      fetchImpl: async (url) =>
        String(url) === XAI_OAUTH_DEVICE_URL
          ? jsonResponse(devicePayload({ interval: 1 }))
          : jsonResponse(tokenPayload()),
    },
  });
}

function providerConfig() {
  return {
    name: "xAI integration test",
    baseUrl: "https://cli-chat-proxy.grok.com/v1",
    api: "xai-responses",
    models: [
      {
        id: "grok-integration-test",
        name: "Grok integration test",
        reasoning: false,
        input: ["text"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 1_000,
        maxTokens: 100,
      },
    ],
    oauth: oauthWithClock(),
  };
}

function runtimeInteraction(callbacks: OAuthLoginCallbacks) {
  return {
    signal: callbacks.signal,
    async prompt(prompt: any): Promise<string> {
      if (prompt.type === "select") {
        return (await callbacks.onSelect?.({ message: prompt.message, options: prompt.options })) ?? "";
      }
      if (prompt.type === "manual_code") {
        return (await callbacks.onManualCodeInput?.()) ?? "";
      }
      return callbacks.onPrompt({ message: prompt.message, placeholder: prompt.placeholder });
    },
    notify(event: any): void {
      if (event.type === "auth_url") {
        callbacks.onAuth?.({ url: event.url, instructions: event.instructions });
      } else if (event.type === "device_code") {
        callbacks.onDeviceCode({
          userCode: event.userCode,
          verificationUri: event.verificationUri,
          intervalSeconds: event.intervalSeconds,
          expiresInSeconds: event.expiresInSeconds,
        });
      } else if (event.type === "progress") {
        callbacks.onProgress?.(event.message);
      }
    },
  };
}

async function createPiAuthHarness(id: string, initial?: any) {
  const codingAgent = (await import("@earendil-works/pi-coding-agent")) as any;
  const piAi = (await import("@earendil-works/pi-ai")) as any;

  if (typeof codingAgent.ModelRuntime === "function" && typeof piAi.InMemoryCredentialStore === "function") {
    const credentials = new piAi.InMemoryCredentialStore();
    if (initial) await credentials.modify(id, async () => initial);
    const runtime = await codingAgent.ModelRuntime.create({
      credentials,
      modelsPath: null,
      allowModelNetwork: false,
    });
    runtime.registerProvider(id, providerConfig());
    return {
      login: (callbacks: OAuthLoginCallbacks) => runtime.login(id, "oauth", runtimeInteraction(callbacks)),
      read: () => credentials.read(id),
    };
  }

  const legacyOAuth = (await import("@earendil-works/pi-ai/oauth")) as any;
  legacyOAuth.registerOAuthProvider({ id, ...oauthWithClock() });
  const storage = codingAgent.AuthStorage.inMemory(initial ? { [id]: initial } : {});
  return {
    login: (callbacks: OAuthLoginCallbacks) => storage.login(id, callbacks),
    read: async () => storage.get(id),
  };
}

describe("Pi credential-runtime device integration", () => {
  it("preserves existing credentials when login is cancelled", async () => {
    const id = `xai-cancel-${crypto.randomUUID()}`;
    const harness = await createPiAuthHarness(id, {
      type: "oauth",
      access: "existing-access",
      refresh: "existing-refresh",
      expires: Date.now() + 60_000,
    });
    const controller = new AbortController();
    await expect(
      harness.login({
        onPrompt: async () => "n",
        onAuth: () => {},
        onSelect: async () => XAI_DEVICE_LOGIN_METHOD,
        onDeviceCode: () => controller.abort(),
        signal: controller.signal,
      } as any),
    ).rejects.toThrow("Login cancelled");
    await expect(harness.read()).resolves.toMatchObject({
      access: "existing-access",
      refresh: "existing-refresh",
    });
  });

  it("persists a completed device login", async () => {
    const id = `xai-success-${crypto.randomUUID()}`;
    const harness = await createPiAuthHarness(id);
    await harness.login({
      onPrompt: async () => "n",
      onAuth: () => {},
      onSelect: async () => XAI_DEVICE_LOGIN_METHOD,
      onDeviceCode: () => {},
    } as any);
    await expect(harness.read()).resolves.toMatchObject({
      access: "device-access-token",
      refresh: "device-refresh-token",
    });
  });
});
