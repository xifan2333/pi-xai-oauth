import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  normalizeXaiCatalogPayload,
  XaiCatalogValidationError,
} from "../../extensions/xai/catalog";

const fixture = async (name: string) =>
  JSON.parse(
    await readFile(
      join(process.cwd(), "tests/fixtures/models-v2", name),
      "utf8",
    ),
  );

describe("catalog normalization", () => {
  it("preserves exact additions and known/unknown metadata", async () => {
    const models = normalizeXaiCatalogPayload(await fixture("additions.json"));
    expect(models.map(({ id }) => id)).toEqual([
      "grok-4.5",
      "grok-composer-2.5-fast",
      "grok-new-oauth-model",
    ]);
    expect(models[0]).toMatchObject({
      contextWindow: 500_000,
      maxTokens: 131_072,
    });
    expect(models[0].thinkingLevelMap).toMatchObject({
      off: null,
      minimal: "low",
    });
    expect(models[2]).toMatchObject({
      input: ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    });
    expect(models[2].thinkingLevelMap).toMatchObject({
      medium: "medium",
      xhigh: "xhigh",
    });
  });

  it("maps none and capability defaults to Pi thinking levels", () => {
    const none = normalizeXaiCatalogPayload({
      data: [
        {
          model: "none-capable",
          api_backend: "responses",
          context_window: 100_000,
          supports_reasoning_effort: true,
          reasoning_efforts: ["none", "low"],
        },
      ],
    })[0];
    expect(none.thinkingLevelMap?.off).toBe("none");
    for (const levels of [undefined, [], "malformed"]) {
      const model = normalizeXaiCatalogPayload({
        data: [
          {
            model: "implicit",
            api_backend: "responses",
            context_window: 100_000,
            supports_reasoning_effort: true,
            ...(levels === undefined ? {} : { reasoning_efforts: levels }),
          },
        ],
      })[0];
      expect(model.thinkingLevelMap).toMatchObject({
        low: "low",
        medium: "medium",
        high: "high",
      });
    }
  });

  it("lets authenticated denial override known reasoning metadata", () => {
    const model = normalizeXaiCatalogPayload({
      data: [
        {
          model: "grok-4.5",
          api_backend: "responses",
          context_window: 500_000,
          supports_reasoning_effort: false,
          reasoning_efforts: ["low", "high"],
        },
      ],
    })[0];
    expect(model.reasoning).toBe(false);
    expect(model.thinkingLevelMap).toEqual({ off: "none" });
  });

  it("clamps known output metadata to the authenticated context", () => {
    expect(
      normalizeXaiCatalogPayload({
        data: [
          {
            model: "grok-4.5",
            api_backend: "responses",
            context_window: 100_000,
          },
        ],
      })[0].maxTokens,
    ).toBe(100_000);
  });

  it("treats removals and an empty success as exact entitlements", async () => {
    expect(
      normalizeXaiCatalogPayload(await fixture("removals.json")).map(
        ({ id }) => id,
      ),
    ).toEqual(["grok-composer-2.5-fast"]);
    expect(normalizeXaiCatalogPayload({ data: [] })).toEqual([]);
  });

  it("filters malformed entries but rejects wholly malformed payloads", async () => {
    expect(
      normalizeXaiCatalogPayload(await fixture("malformed.json")).map(
        ({ id }) => id,
      ),
    ).toEqual(["meta-valid-model"]);
    expect(() =>
      normalizeXaiCatalogPayload({
        data: [{ model: "bad", context_window: 1000 }],
      }),
    ).toThrow(XaiCatalogValidationError);
    expect(() => normalizeXaiCatalogPayload({ models: [] })).toThrow(
      XaiCatalogValidationError,
    );
  });

  it("filters API-key and secret-bearing models before normalization", async () => {
    const models = normalizeXaiCatalogPayload(
      await fixture("api-key-only.json"),
    );
    expect(models.map(({ id }) => id)).toEqual(["oauth-safe-model"]);
    expect(models[0].name).toBe("OAuth Safe Model");
    expect(JSON.stringify(models)).not.toMatch(
      /MUST_NOT_REACH_CACHE|XAI_API_KEY/,
    );
  });
});
