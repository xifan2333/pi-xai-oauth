import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import packageMetadata from "../../package.json";
import {
  CURATED_FALLBACK_MODELS,
  KNOWN_XAI_MODEL_METADATA,
  resolveXaiClientMode,
  setXaiRuntimeModels,
} from "../../extensions/xai/models";
import {
  createXaiResponse,
  postXaiJson,
  streamSimpleXaiResponses,
} from "../../extensions/xai/responses";
import { headerValue, jsonResponse, requestBody } from "../fixtures/http";
import { TEST_MODEL } from "../fixtures/models";

const modelIds = [
  "grok-4.5",
  "grok-4.3",
  "grok-4.20-0309-reasoning",
  "grok-build",
  "grok-composer-2.5-fast",
];
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const proxyHeaderNames = [
  "x-grok-client-identifier",
  "x-grok-client-version",
  "x-xai-token-auth",
  "x-authenticateresponse",
  "x-grok-client-mode",
  "x-grok-conv-id",
  "x-grok-req-id",
  "x-grok-model-override",
  "x-grok-session-id",
];

let requests: Array<{ url: string; init: RequestInit; body: any }>;

beforeEach(() => {
  requests = [];
  setXaiRuntimeModels(KNOWN_XAI_MODEL_METADATA);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: any, init: RequestInit = {}) => {
      requests.push({ url: String(url), init, body: requestBody(init) });
      return jsonResponse({ id: "resp", output_text: "OK" });
    }),
  );
});

afterEach(() => setXaiRuntimeModels(CURATED_FALLBACK_MODELS));

function proxyHeaders(request: (typeof requests)[number]) {
  return Object.fromEntries(
    proxyHeaderNames.flatMap((name) => {
      const value = headerValue(request.init.headers, name);
      return value === undefined ? [] : [[name, value]];
    }),
  );
}

function expectProxy(
  request: (typeof requests)[number],
  modelId: string,
  conversationId: string,
): string {
  const requestId = headerValue(request.init.headers, "x-grok-req-id") ?? "";
  expect(request.init.method).toBe("POST");
  expect(request.body.model).toBe(modelId);
  expect(new URL(request.url).origin).toBe("https://cli-chat-proxy.grok.com");
  expect(headerValue(request.init.headers, "Content-Type")).toBe(
    "application/json",
  );
  expect(headerValue(request.init.headers, "Authorization")).toBe(
    "Bearer oauth-token",
  );
  expect(requestId).toMatch(uuid);
  expect(proxyHeaders(request)).toEqual({
    "x-grok-client-identifier": packageMetadata.name,
    "x-grok-client-version": packageMetadata.version,
    "x-xai-token-auth": "xai-grok-cli",
    "x-authenticateresponse": "authenticate-response",
    "x-grok-client-mode": resolveXaiClientMode(),
    "x-grok-conv-id": conversationId,
    "x-grok-req-id": requestId,
    "x-grok-model-override": modelId,
    "x-grok-session-id": conversationId,
  });
  return requestId;
}

describe("Responses routing and protected metadata", () => {
  it.each(modelIds)(
    "routes stream and direct OAuth requests for %s through the CLI proxy",
    async (modelId) => {
      const catalogModel = KNOWN_XAI_MODEL_METADATA.find(
        ({ id }) => id === modelId,
      )!;
      const model = {
        ...catalogModel,
        provider: "xai-auth",
        api: "xai-responses",
        baseUrl: "https://cli-chat-proxy.grok.com/v1",
        headers: {},
      } as any;
      const sessionId = `stream-${modelId}`;

      const streamStart = requests.length;
      const stream = streamSimpleXaiResponses(
        model,
        {
          messages: [{ role: "user", content: "hello", timestamp: Date.now() }],
        } as any,
        { apiKey: "oauth-token", sessionId } as any,
      );
      await stream.result();
      const streamRequest = requests
        .slice(streamStart)
        .find(({ url }) => url.endsWith("/responses"))!;
      const streamRequestId = expectProxy(streamRequest, modelId, sessionId);
      if (modelId === "grok-composer-2.5-fast") {
        expect(streamRequest.body.reasoning).toBeUndefined();
      }

      const directStart = requests.length;
      await createXaiResponse(
        { kind: "oauth-session", token: "oauth-token" },
        {
          model: modelId,
          input: "hello",
          previous_response_id: "not-session-metadata",
        },
      );
      const directRequest = requests
        .slice(directStart)
        .find(({ url }) => url.endsWith("/responses"))!;
      const directConversationId =
        headerValue(directRequest.init.headers, "x-grok-conv-id") ?? "";
      expect(directConversationId).toMatch(uuid);
      expect(directConversationId).not.toBe(
        directRequest.body.previous_response_id,
      );
      const directRequestId = expectProxy(
        directRequest,
        modelId,
        directConversationId,
      );
      expect(directRequestId).not.toBe(streamRequestId);
    },
  );

  it("mints a session UUID and overwrites caller-spoofed authorization and proxy headers", async () => {
    const spoofed = {
      Authorization: "Bearer spoofed",
      "x-grok-client-identifier": "spoofed-client",
      "x-grok-client-version": "999",
      "x-xai-token-auth": "spoofed-mode",
      "x-authenticateresponse": "spoofed-auth",
      "x-grok-client-mode": "spoofed-mode",
      "x-grok-conv-id": "spoofed-conversation",
      "x-grok-req-id": "spoofed-request",
      "x-grok-model-override": "spoofed-model",
      "x-grok-session-id": "spoofed-session",
    };
    const model = { ...TEST_MODEL, headers: spoofed } as any;
    const stream = streamSimpleXaiResponses(
      model,
      {
        messages: [{ role: "user", content: "hello", timestamp: Date.now() }],
      } as any,
      { apiKey: "oauth-token", headers: spoofed } as any,
    );
    await stream.result();

    const request = requests.find(({ url }) => url.endsWith("/responses"))!;
    const conversationId =
      headerValue(request.init.headers, "x-grok-conv-id") ?? "";
    expect(conversationId).toMatch(uuid);
    expectProxy(request, "grok-4.5", conversationId);
  });

  it("routes explicit API keys through api.x.ai with no proxy metadata", async () => {
    await createXaiResponse(
      { kind: "api-key", token: "api-key-token" },
      { model: "grok-build", input: "hello" },
    );
    const request = requests.at(-1)!;
    expect(request.init.method).toBe("POST");
    expect(new URL(request.url).origin).toBe("https://api.x.ai");
    expect(headerValue(request.init.headers, "Content-Type")).toBe(
      "application/json",
    );
    expect(headerValue(request.init.headers, "Authorization")).toBe(
      "Bearer api-key-token",
    );
    expect(proxyHeaders(request)).toEqual({});
  });

  it("rejects an unentitled OAuth model before network", async () => {
    setXaiRuntimeModels(CURATED_FALLBACK_MODELS);
    await expect(
      createXaiResponse(
        { kind: "oauth-session", token: "oauth-token" },
        { model: "grok-build", input: "no" },
      ),
    ).rejects.toThrow(/not present in the authenticated model catalog/);
    expect(requests).toHaveLength(0);
  });

  it("uses xAI error labels and preserves HTTP status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () => new Response("OpenAI API error: failed", { status: 500 }),
      ),
    );
    const error = await postXaiJson("token", "https://example.test", {}).catch(
      (value) => value as any,
    );
    expect(error.status).toBe(500);
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
