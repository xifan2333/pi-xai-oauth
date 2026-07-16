import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  registerApiProvider,
  resetApiProviders,
  streamSimple,
} from "@earendil-works/pi-ai/compat";
import {
  CURATED_FALLBACK_MODELS,
  KNOWN_XAI_MODEL_METADATA,
  setXaiRuntimeModels,
} from "../../extensions/xai/models";
import { streamSimpleXaiResponses } from "../../extensions/xai/responses";
import { jsonResponse } from "../fixtures/http";
import { TEST_MODEL } from "../fixtures/models";
beforeEach(() => {
  setXaiRuntimeModels(KNOWN_XAI_MODEL_METADATA);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => jsonResponse({ id: "resp", output_text: "OK" })),
  );
});
afterEach(() => {
  resetApiProviders();
  setXaiRuntimeModels(CURATED_FALLBACK_MODELS);
});

describe("xAI streaming adapter", () => {
  it("uses Pi's real OpenAI Responses transport for the configured xAI endpoint", async () => {
    const model = {
      ...TEST_MODEL,
      id: "grok-4.3",
      api: "openai-responses",
      baseUrl: "https://api.x.ai/v1",
    } as any;
    const stream = streamSimple(
      model,
      {
        messages: [{ role: "user", content: "hello", timestamp: Date.now() }],
      } as any,
      { apiKey: "oauth-token" } as any,
    );
    await stream.result();

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/^https:\/\/api\.x\.ai\/v1\/responses/),
      expect.any(Object),
    );
  });
  it("bypasses conflicting compat registrations and exposes a terminal result", async () => {
    let called = false;
    registerApiProvider(
      {
        api: "openai-responses",
        stream() {
          called = true;
          throw new Error("conflict");
        },
        streamSimple() {
          called = true;
          throw new Error("conflict");
        },
      } as any,
      "test-conflict",
    );
    const stream = streamSimpleXaiResponses(
      TEST_MODEL,
      {
        messages: [{ role: "user", content: "hello", timestamp: Date.now() }],
      } as any,
      { apiKey: "oauth-token", sessionId: "session" } as any,
    );
    const result = await stream.result();
    expect(called).toBe(false);
    expect(result).toBeDefined();
    expect(globalThis.fetch).toHaveBeenCalled();
  });
  it("returns a local terminal error for an unentitled model without network", async () => {
    setXaiRuntimeModels(CURATED_FALLBACK_MODELS);
    const model = { ...TEST_MODEL, id: "grok-build" } as any;
    const stream = streamSimpleXaiResponses(
      model,
      { messages: [] } as any,
      { apiKey: "token" } as any,
    );
    const events: any[] = [];
    for await (const event of stream) events.push(event);
    const result = await stream.result();
    expect(result.stopReason).toBe("error");
    expect(result.errorMessage).toMatch(
      /not present in the authenticated model catalog/,
    );
    expect(events.at(-1).type).toBe("error");
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
  it("forwards an xAI-labeled terminal error when transport throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({ code: "internal", error: "Auth context expired." }, 500),
      ),
    );
    const stream = streamSimpleXaiResponses(
      TEST_MODEL,
      {
        messages: [{ role: "user", content: "hello", timestamp: Date.now() }],
      } as any,
      { apiKey: "oauth-token" } as any,
    );
    const result = await stream.result();
    expect(result.errorMessage).toMatch(/^xAI API error/i);
    expect(result.errorMessage).not.toMatch(/^OpenAI API error/i);
  });
});
