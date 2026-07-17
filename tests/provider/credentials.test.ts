import { access, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getGrokAuthCredentials,
  getStartupXaiCatalogAuth,
  resolveXaiCredential,
} from "../../extensions/xai/auth";
import {
  CURATED_FALLBACK_MODELS,
  setXaiRuntimeModels,
} from "../../extensions/xai/models";
import { createTempDir } from "../fixtures/temp";
import { TEST_MODEL } from "../fixtures/models";
let temp: Awaited<ReturnType<typeof createTempDir>>;
beforeEach(async () => {
  temp = await createTempDir("pi-xai-auth-");
  vi.stubEnv("HOME", temp.path);
});
afterEach(async () => {
  setXaiRuntimeModels(CURATED_FALLBACK_MODELS);
  vi.unstubAllEnvs();
  await temp.cleanup();
});

describe("credential resolution", () => {
  it("does not create Pi auth storage during an absent startup read", async () => {
    expect(getStartupXaiCatalogAuth()).toMatchObject({
      credential: null,
      needsRegistryRefresh: false,
    });
    await expect(access(join(temp.path, ".pi"))).rejects.toMatchObject({ code: "ENOENT" });
  });
  it("reads official Grok CLI credentials without modifying them", async () => {
    const path = join(temp.path, ".grok/auth.json");
    await mkdir(join(path, ".."), { recursive: true });
    await writeFile(
      path,
      JSON.stringify({
        "https://auth.x.ai::b1a00492-073a-47ea-816f-4c329264a828": {
          key: "grok-access",
          refresh_token: "grok-refresh",
          expires_at: Date.now() + 3600_000,
        },
      }),
    );
    expect(getGrokAuthCredentials()).toMatchObject({
      access: "grok-access",
      refresh: "grok-refresh",
      tokenEndpoint: "https://auth.x.ai/oauth2/token",
    });
  });
  it("prefers fresh Grok auth while retaining deferred expired Pi refresh intent", async () => {
    const pi = join(temp.path, ".pi/agent/auth.json");
    await mkdir(join(pi, ".."), { recursive: true });
    await writeFile(
      pi,
      JSON.stringify({
        "xai-auth": {
          type: "oauth",
          access: "expired",
          refresh: "pi-refresh",
          expires: 1,
        },
      }),
    );
    const grok = join(temp.path, ".grok/auth.json");
    await mkdir(join(grok, ".."), { recursive: true });
    await writeFile(
      grok,
      JSON.stringify({
        "https://auth.x.ai::b1a00492-073a-47ea-816f-4c329264a828": {
          key: "fresh-grok-access",
          refresh_token: "refresh",
          expires_at: Date.now() + 3600_000,
        },
      }),
    );
    expect(getStartupXaiCatalogAuth()).toMatchObject({
      credential: { access: "fresh-grok-access" },
      needsRegistryRefresh: true,
    });
  });
  it("uses the active entitled model when the fallback model is absent", async () => {
    const model = { ...TEST_MODEL, id: "grok-composer-2.5-fast" } as any;
    setXaiRuntimeModels([{ ...CURATED_FALLBACK_MODELS[0], id: model.id }]);
    const credential = await resolveXaiCredential({
      model,
      modelRegistry: {
        find: (_provider: string, id: string) =>
          id === model.id ? model : undefined,
        getApiKeyAndHeaders: async () => ({
          ok: true,
          apiKey: "composer-only-token",
        }),
      },
    });
    expect(credential).toEqual({
      kind: "oauth-session",
      token: "composer-only-token",
    });
  });
  it("uses Authorization bearer when registry omits apiKey", async () => {
    const credential = await resolveXaiCredential({
      model: TEST_MODEL,
      modelRegistry: {
        find: () => TEST_MODEL,
        getApiKeyAndHeaders: async () => ({
          ok: true,
          headers: { Authorization: "Bearer header-token" },
        }),
      },
    });
    expect(credential).toEqual({
      kind: "oauth-session",
      token: "header-token",
    });
  });
});
