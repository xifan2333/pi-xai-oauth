import { chmod, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchXaiModelCatalog,
  normalizeXaiCatalogPayload,
  selectXaiModelCatalog,
  XaiCatalogCancelledError,
} from "../../extensions/xai/catalog";
import {
  XAI_CLI_MODELS_URL,
  XAI_MODEL_CATALOG_CACHE_SCHEMA,
  XAI_MODEL_CATALOG_FRESH_TTL_MS,
  XAI_MODEL_CATALOG_MAX_BYTES,
  XAI_MODEL_CATALOG_MAX_STALE_MS,
} from "../../extensions/xai/constants";
import { createTempDir } from "../fixtures/temp";
import apiKeyOnlyFixture from "../fixtures/models-v2/api-key-only.json";
import { headerValue, jsonResponse } from "../fixtures/http";

const now = 2_000_000_000_000;
const token = "OAUTH_TOKEN_MUST_NEVER_REACH_CACHE";
let temp: Awaited<ReturnType<typeof createTempDir>>;
const additionsPayload = {
  data: [
    {
      model: "grok-4.5",
      name: "Grok 4.5",
      api_backend: "responses",
      context_window: 500_000,
      supports_reasoning_effort: true,
      reasoning_efforts: ["low", "medium", "high"],
    },
    { model: "oauth-new", api_backend: "responses", context_window: 100_000 },
  ],
};
const removalsPayload = {
  data: [
    {
      model: "grok-composer-2.5-fast",
      api_backend: "responses",
      context_window: 200_000,
    },
  ],
};
const additions = normalizeXaiCatalogPayload(additionsPayload);

async function writeCache(path: string, fetchedAt: number, models = additions) {
  await mkdir(join(path, ".."), { recursive: true });
  await writeFile(
    path,
    JSON.stringify({
      schemaVersion: XAI_MODEL_CATALOG_CACHE_SCHEMA,
      fetchedAt,
      models,
    }),
  );
}

beforeEach(async () => {
  temp = await createTempDir("pi-xai-catalog-");
});
afterEach(async () => {
  await temp.cleanup();
});

describe("catalog cache selection", () => {
  it("uses a fresh cache without network and tightens permissions", async () => {
    const path = join(temp.path, "fresh", "models-v2.json");
    await writeCache(path, now - XAI_MODEL_CATALOG_FRESH_TTL_MS + 1);
    await chmod(path, 0o644);
    const fetchImpl = vi.fn(async () => {
      throw new Error("must not fetch");
    });
    const selection = await selectXaiModelCatalog({
      credential: { access: token },
      cachePath: path,
      now,
      fetchImpl,
    });
    expect(selection.source).toBe("fresh-cache");
    expect(fetchImpl).not.toHaveBeenCalled();
    expect((await stat(path)).mode & 0o777).toBe(0o600);
    expect((await selectXaiModelCatalog({ cachePath: path, now })).source).toBe(
      "curated-fallback",
    );
  });

  it("refreshes stale data through only the pinned authenticated GET and replaces the cache", async () => {
    const path = join(temp.path, "stale", "models-v2.json");
    await writeCache(path, now - XAI_MODEL_CATALOG_FRESH_TTL_MS);
    let request: { url: string; init: RequestInit } | undefined;
    const result = await selectXaiModelCatalog({
      credential: { access: token },
      cachePath: path,
      now,
      fetchImpl: async (url, init) => {
        request = { url: String(url), init: init! };
        return jsonResponse(removalsPayload);
      },
    });
    expect(result.source).toBe("remote");
    expect(result.models.map(({ id }) => id)).toEqual([
      "grok-composer-2.5-fast",
    ]);
    expect(request?.url).toBe(XAI_CLI_MODELS_URL);
    expect(request?.init).toMatchObject({ method: "GET", redirect: "error" });
    expect(headerValue(request?.init.headers, "X-XAI-Token-Auth")).toBe(
      "xai-grok-cli",
    );
    expect(headerValue(request?.init.headers, "Authorization")).toBe(
      `Bearer ${token}`,
    );
    const text = await readFile(path, "utf8");
    expect(text).not.toContain(token);
    expect(JSON.parse(text).models.map((model: any) => model.id)).toEqual([
      "grok-composer-2.5-fast",
    ]);
    expect((await stat(path)).mode & 0o777).toBe(0o600);
  });

  it("forces discovery when credentials changed after a fresh cache", async () => {
    const path = join(temp.path, "changed", "models-v2.json");
    await writeCache(path, now - 1);
    const fetchImpl = vi.fn(async () => jsonResponse(removalsPayload));
    expect(
      (
        await selectXaiModelCatalog({
          credential: { access: token },
          credentialChangedAt: now,
          cachePath: path,
          now,
          fetchImpl,
        })
      ).source,
    ).toBe("remote");
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it.each([
    [
      "offline",
      async () => {
        throw new Error("offline");
      },
    ],
    [
      "oversized",
      async () =>
        jsonResponse({}, 200, {
          "Content-Length": String(XAI_MODEL_CATALOG_MAX_BYTES + 1),
        }),
    ],
    [
      "malformed success",
      async () => jsonResponse({ data: [{ model: "broken" }] }),
    ],
  ])("keeps eligible stale data after %s", async (_label, fetchImpl) => {
    const path = join(temp.path, "stale-fallback", "models-v2.json");
    await writeCache(path, now - XAI_MODEL_CATALOG_FRESH_TTL_MS);
    const result = await selectXaiModelCatalog({
      credential: { access: token },
      cachePath: path,
      now,
      fetchImpl,
    });
    expect(result.source).toBe("stale-cache");
    expect(result.models.map(({ id }) => id)).toEqual(
      additions.map(({ id }) => id),
    );
  });

  it("does not commit after caller cancellation", async () => {
    const path = join(temp.path, "cancel", "models-v2.json");
    await writeCache(path, now - XAI_MODEL_CATALOG_FRESH_TTL_MS);
    const before = await readFile(path, "utf8");
    const controller = new AbortController();
    let resolve!: (response: Response) => void;
    let markStarted!: () => void;
    const started = new Promise<void>((done) => {
      markStarted = done;
    });
    const pending = selectXaiModelCatalog({
      credential: { access: token },
      cachePath: path,
      now,
      forceRefresh: true,
      signal: controller.signal,
      fetchImpl: async () =>
        new Promise<Response>((done) => {
          resolve = done;
          markStarted();
        }),
    });
    await started;
    controller.abort();
    resolve(jsonResponse(removalsPayload));
    await expect(pending).rejects.toBeInstanceOf(XaiCatalogCancelledError);
    expect(await readFile(path, "utf8")).toBe(before);
  });

  it("restores the previous cache when the commit guard changes", async () => {
    const path = join(temp.path, "guard", "models-v2.json");
    await writeCache(path, now - XAI_MODEL_CATALOG_FRESH_TTL_MS);
    let checks = 0;
    await expect(
      selectXaiModelCatalog({
        credential: { access: token },
        cachePath: path,
        now,
        commitAllowed: () => ++checks < 4,
        fetchImpl: async () => jsonResponse(removalsPayload),
      }),
    ).rejects.toBeInstanceOf(XaiCatalogCancelledError);
    expect(
      JSON.parse(await readFile(path, "utf8")).models.map(
        (model: any) => model.id,
      ),
    ).toEqual(additions.map(({ id }) => id));
  });

  it("invalidates stale entitlements after auth failure", async () => {
    const path = join(temp.path, "auth", "models-v2.json");
    await writeCache(path, now - XAI_MODEL_CATALOG_FRESH_TTL_MS);
    const result = await selectXaiModelCatalog({
      credential: { access: token },
      cachePath: path,
      now,
      fetchImpl: async () => jsonResponse({}, 401),
    });
    expect(result).toMatchObject({
      source: "curated-fallback",
      needsAuthenticatedRefresh: false,
    });
    expect(result.models.map(({ id }) => id)).toEqual(["grok-4.5"]);
    expect(JSON.parse(await readFile(path, "utf8")).invalidated).toBe(true);
  });

  it("never reuses old-account cache after a forced transient failure", async () => {
    const path = join(temp.path, "forced", "models-v2.json");
    await writeCache(path, now - XAI_MODEL_CATALOG_FRESH_TTL_MS);
    const result = await selectXaiModelCatalog({
      credential: { access: token },
      cachePath: path,
      now,
      forceRefresh: true,
      fetchImpl: async () => {
        throw new Error("offline");
      },
    });
    expect(result).toMatchObject({
      source: "curated-fallback",
      needsAuthenticatedRefresh: true,
    });
    expect(JSON.parse(await readFile(path, "utf8")).invalidated).toBe(true);
  });

  it("uses fallback for missing, too-old, and deferred credential states", async () => {
    const missing = await selectXaiModelCatalog({
      credential: { access: token },
      cachePath: join(temp.path, "missing.json"),
      now,
      fetchImpl: async () => {
        throw new Error("offline");
      },
    });
    expect(missing).toMatchObject({
      source: "curated-fallback",
      needsAuthenticatedRefresh: true,
    });
    const oldPath = join(temp.path, "old", "models-v2.json");
    await writeCache(oldPath, now - XAI_MODEL_CATALOG_MAX_STALE_MS - 1);
    expect(
      (
        await selectXaiModelCatalog({
          credential: { access: token },
          cachePath: oldPath,
          now,
          fetchImpl: async () => {
            throw new Error("offline");
          },
        })
      ).source,
    ).toBe("curated-fallback");
    expect(
      await selectXaiModelCatalog({
        cachePath: join(temp.path, "none.json"),
        now,
        refreshWhenCredentialsAvailable: true,
      }),
    ).toMatchObject({
      source: "curated-fallback",
      needsAuthenticatedRefresh: true,
    });
  });

  it("suppresses fresh cache with an invalidation sidecar and clears it on success", async () => {
    const path = join(temp.path, "marker", "models-v2.json");
    await writeCache(path, now - 1);
    await writeFile(`${path}.invalidated`, `1:${now}\n`);
    const fetchImpl = vi.fn(async () => jsonResponse(removalsPayload));
    expect(
      (
        await selectXaiModelCatalog({
          credential: { access: token },
          cachePath: path,
          now: now + 1,
          fetchImpl,
        })
      ).source,
    ).toBe("remote");
    expect(fetchImpl).toHaveBeenCalledOnce();
    await expect(stat(`${path}.invalidated`)).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("persists only normalized OAuth-safe models from a secret-bearing response", async () => {
    const path = join(temp.path, "secret-filter", "models-v2.json");
    const selection = await selectXaiModelCatalog({
      credential: { access: token },
      cachePath: path,
      now,
      fetchImpl: async () => jsonResponse(apiKeyOnlyFixture),
    });

    expect(selection.source).toBe("remote");
    expect(selection.models.map(({ id }) => id)).toEqual(["oauth-safe-model"]);
    const cache = await readFile(path, "utf8");
    expect(cache).not.toMatch(
      /MUST_NOT_REACH_CACHE|XAI_API_KEY|OAUTH_TOKEN_MUST_NEVER_REACH_CACHE/,
    );
  });

  it("preserves deferred Pi refresh intent after a successful authenticated fetch", async () => {
    const selection = await selectXaiModelCatalog({
      credential: { access: token },
      refreshWhenCredentialsAvailable: true,
      cachePath: join(temp.path, "deferred", "models-v2.json"),
      now,
      fetchImpl: async () => jsonResponse(additionsPayload),
    });

    expect(selection).toMatchObject({
      source: "remote",
      needsAuthenticatedRefresh: true,
    });
  });

  it("direct fetch normalizes successful catalog responses", async () => {
    await expect(
      fetchXaiModelCatalog(
        { access: token },
        { fetchImpl: async () => jsonResponse(additionsPayload) },
      ),
    ).resolves.toMatchObject({ kind: "success" });
  });
});
