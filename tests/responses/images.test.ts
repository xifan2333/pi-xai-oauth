import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_XAI_INLINE_IMAGE_BASE64_BYTES } from "../../extensions/xai/images";
import {
  CURATED_FALLBACK_MODELS,
  KNOWN_XAI_MODEL_METADATA,
  setXaiRuntimeModels,
} from "../../extensions/xai/models";
import {
  createXaiResponse,
  streamSimpleXaiResponses,
} from "../../extensions/xai/responses";
import { jsonResponse, requestBody } from "../fixtures/http";
import { TEST_MODEL } from "../fixtures/models";
let requests: any[];
let oversized: string;
let input: any[];
function images(value: any) {
  const result: string[] = [];
  const walk = (item: any) => {
    if (Array.isArray(item)) return item.forEach(walk);
    if (!item || typeof item !== "object") return;
    if (item.type === "input_image" && typeof item.image_url === "string")
      result.push(item.image_url);
    Object.values(item).forEach(walk);
  };
  walk(value);
  return result;
}
beforeEach(async () => {
  setXaiRuntimeModels(KNOWN_XAI_MODEL_METADATA);
  requests = [];
  const bytes = Buffer.concat(Array(10).fill(await readFile("preview.jpeg")));
  oversized = `data:image/jpeg;base64,${bytes.toString("base64")}`;
  input = [
    {
      role: "user",
      content: [
        { type: "input_image", image_url: oversized },
        { type: "input_image", image_url: oversized },
        { type: "input_text", text: "OK" },
      ],
    },
  ];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: any, init: RequestInit = {}) => {
      requests.push({ url: String(url), body: requestBody(init) });
      return jsonResponse({ id: "resp", output_text: "OK" });
    }),
  );
});
afterEach(() => setXaiRuntimeModels(CURATED_FALLBACK_MODELS));
function bytes(value: any) {
  return images(value).reduce(
    (total, url) => total + Buffer.byteLength(url.split(",")[1] ?? ""),
    0,
  );
}
describe("Responses image preparation", () => {
  it("compacts direct helper images before transport", async () => {
    await createXaiResponse(
      { kind: "oauth-session", token: "oauth-token" },
      { model: "grok-4.5", input },
    );
    const body = requests.at(-1).body;
    expect(bytes(body)).toBeLessThanOrEqual(MAX_XAI_INLINE_IMAGE_BASE64_BYTES);
    expect(images(body)).not.toContain(oversized);
  });
  it("compacts provider stream images before transport", async () => {
    const data = oversized.split(",")[1];
    const stream = streamSimpleXaiResponses(
      TEST_MODEL,
      {
        messages: [
          {
            role: "user",
            content: [
              { type: "image", data, mimeType: "image/jpeg" },
              { type: "image", data, mimeType: "image/jpeg" },
            ],
            timestamp: Date.now(),
          },
        ],
      } as any,
      { apiKey: "oauth-token", sessionId: "image-session" } as any,
    );
    await stream.result();
    const body = requests.find(({ url }) => url.endsWith("/responses")).body;
    expect(bytes(body)).toBeLessThanOrEqual(MAX_XAI_INLINE_IMAGE_BASE64_BYTES);
    expect(images(body)).not.toContain(oversized);
  }, 30_000);
  it("compacts in-place payload-hook mutations", async () => {
    const stream = streamSimpleXaiResponses(
      TEST_MODEL,
      {
        messages: [{ role: "user", content: "hello", timestamp: Date.now() }],
      } as any,
      {
        apiKey: "oauth-token",
        sessionId: "hook",
        onPayload(payload: any) {
          payload.input = input;
        },
      } as any,
    );
    await stream.result();
    const body = requests.find(({ url }) => url.endsWith("/responses")).body;
    expect(bytes(body)).toBeLessThanOrEqual(MAX_XAI_INLINE_IMAGE_BASE64_BYTES);
  }, 30_000);
});
