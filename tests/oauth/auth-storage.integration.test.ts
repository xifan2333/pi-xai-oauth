import { describe, expect, it } from "vitest";
import { AuthStorage } from "@earendil-works/pi-coding-agent";
import { registerOAuthProvider } from "@earendil-works/pi-ai/oauth";
import {
  createXaiOAuth,
  XAI_DEVICE_LOGIN_METHOD,
} from "../../extensions/xai/oauth";
import { XAI_OAUTH_DEVICE_URL } from "../../extensions/xai/constants";
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

describe("Pi AuthStorage device integration", () => {
  it("preserves existing credentials when login is cancelled", async () => {
    const id = `xai-cancel-${crypto.randomUUID()}`;
    registerOAuthProvider({ id, ...oauthWithClock() });
    const storage = AuthStorage.inMemory({
      [id]: {
        type: "oauth",
        access: "existing-access",
        refresh: "existing-refresh",
        expires: Date.now() + 60_000,
      },
    });
    const controller = new AbortController();
    await expect(
      storage.login(id, {
        onPrompt: async () => "n",
        onAuth: () => {},
        onSelect: async () => XAI_DEVICE_LOGIN_METHOD,
        onDeviceCode: () => controller.abort(),
        signal: controller.signal,
      } as any),
    ).rejects.toThrow("Login cancelled");
    expect(storage.get(id)).toMatchObject({
      access: "existing-access",
      refresh: "existing-refresh",
    });
  });

  it("persists a completed device login", async () => {
    const id = `xai-success-${crypto.randomUUID()}`;
    registerOAuthProvider({ id, ...oauthWithClock() });
    const storage = AuthStorage.inMemory();
    await storage.login(id, {
      onPrompt: async () => "n",
      onAuth: () => {},
      onSelect: async () => XAI_DEVICE_LOGIN_METHOD,
      onDeviceCode: () => {},
    } as any);
    expect(storage.get(id)).toMatchObject({
      access: "device-access-token",
      refresh: "device-refresh-token",
    });
  });
});
