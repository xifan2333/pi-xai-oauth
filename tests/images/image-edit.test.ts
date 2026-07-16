import { lstat, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildXaiImageEditPayload,
  executeXaiImageEdit,
  ImageEditOperationError,
  validateXaiEditImageInput,
  type ImageEditDependencies,
  type XaiEditImageInput,
} from "../../extensions/xai/image-edit";
import type { ImageCodec } from "../../extensions/xai/media/compression";
import {
  IMAGE_EDIT_MAX_OUTPUT_BYTES,
  IMAGE_EDIT_MAX_OUTPUT_PIXELS,
} from "../../extensions/xai/media/constants";
import { imageEditOutputRoot } from "../../extensions/xai/media/output-storage";
import { createTempDir } from "../fixtures/temp";
import { jsonResponse, requestBody } from "../fixtures/http";
import { pngHeaderBytes, tinyPngBytes } from "../fixtures/images";

const png = tinyPngBytes();
const dataUrl = `data:image/png;base64,${png.toString("base64")}`;
const codec: ImageCodec = {
  verify: vi.fn(async (image) => ({ width: image.width, height: image.height })),
  compress: vi.fn(async () => null),
};

describe("image-edit validation and wire payload", () => {
  it("validates bounded prompt, reference shape/count, schemes, and multi-image ratio", () => {
    expect(validateXaiEditImageInput({ prompt: "edit", image: [{ data_url: dataUrl }] })).toMatchObject({
      prompt: "edit",
    });
    expect(validateXaiEditImageInput({
      prompt: "edit",
      image: [{ path: "C:\\workspace\\image.png" }],
    })).toMatchObject({ image: [{ path: "C:\\workspace\\image.png" }] });
    for (const input of [
      {},
      { prompt: " ", image: [{ data_url: dataUrl }] },
      { prompt: "edit", image: [] },
      { prompt: "edit", image: Array.from({ length: 5 }, () => ({ data_url: dataUrl })) },
      { prompt: "edit", image: [{ path: "a", data_url: dataUrl }] },
      { prompt: "edit", image: [{ path: "https://example.test/a.png" }] },
      { prompt: "edit", image: [{ path: "file:///tmp/a.png" }] },
      { prompt: "edit", image: [{ data_url: dataUrl }, { data_url: dataUrl }] },
      { prompt: "edit", image: [{ data_url: dataUrl }, { data_url: dataUrl }], aspect_ratio: "bad" },
    ]) {
      expect(() => validateXaiEditImageInput(input)).toThrow(ImageEditOperationError);
    }
  });

  it("builds the exact singular body and omits aspect_ratio even when supplied", () => {
    const input = validateXaiEditImageInput({
      prompt: "edit",
      image: [{ data_url: dataUrl }],
      aspect_ratio: "16:9",
    });
    expect(buildXaiImageEditPayload(input, [{
      dataUrl,
      mimeType: "image/png",
      byteLength: png.length,
      width: 1,
      height: 1,
      wasCompressed: false,
    }])).toEqual({
      model: "grok-imagine-image-quality",
      prompt: "edit",
      n: 1,
      resolution: "1k",
      response_format: "b64_json",
      image: { url: dataUrl },
    });
  });

  it("builds the exact plural body with a validated aspect ratio", () => {
    const input = validateXaiEditImageInput({
      prompt: "combine",
      image: [{ data_url: dataUrl }, { data_url: dataUrl }],
      aspect_ratio: "4:3",
    });
    const reference = { dataUrl, mimeType: "image/png" as const, byteLength: png.length, width: 1, height: 1, wasCompressed: false };
    expect(buildXaiImageEditPayload(input, [reference, reference])).toEqual({
      model: "grok-imagine-image-quality",
      prompt: "combine",
      n: 1,
      resolution: "1k",
      response_format: "b64_json",
      images: [{ url: dataUrl }, { url: dataUrl }],
      aspect_ratio: "4:3",
    });
  });
});

describe("bounded xAI image-edit execution", () => {
  let temp: Awaited<ReturnType<typeof createTempDir>>;
  let workspaceRoot: string;
  let sessionRoot: string;
  let requests: Array<{ url: string; init: RequestInit; body: any }>;
  const sessionManager = () => ({ getSessionDir: () => sessionRoot, getSessionId: () => "image-edit-session" });
  const input = (): XaiEditImageInput => ({ prompt: "make it blue", image: [{ data_url: dataUrl }] });

  beforeEach(async () => {
    temp = await createTempDir("pi-xai-image-edit-");
    workspaceRoot = join(temp.path, "workspace");
    sessionRoot = join(temp.path, "sessions");
    await Promise.all([mkdir(workspaceRoot), mkdir(sessionRoot)]);
    requests = [];
  });
  afterEach(async () => temp.cleanup());

  function dependencies(response: Response = jsonResponse({ data: [{ b64_json: png.toString("base64") }] })): ImageEditDependencies {
    return {
      codec,
      fetch: vi.fn(async (url: any, init: RequestInit = {}) => {
        requests.push({ url: String(url), init, body: requestBody(init) });
        return response;
      }),
    };
  }

  it("posts only to the pinned edit route and atomically saves one verified output", async () => {
    const output = await executeXaiImageEdit({
      credential: { kind: "oauth-session", token: "secret-token" },
      input: input(),
      workspaceRoot,
      sessionManager: sessionManager(),
    }, dependencies());
    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe("https://api.x.ai/v1/images/edits");
    expect(requests[0].init.redirect).toBe("error");
    expect(new Headers(requests[0].init.headers).get("Authorization")).toBe("Bearer secret-token");
    expect(requests[0].body).toMatchObject({
      model: "grok-imagine-image-quality",
      n: 1,
      response_format: "b64_json",
      image: { url: dataUrl },
    });
    expect(requests[0].body).not.toHaveProperty("images");
    expect(requests[0].body).not.toHaveProperty("aspect_ratio");
    expect(output).toMatchObject({ mimeType: "image/png", width: 1, height: 1, byteLength: png.length });
    expect((await lstat(output.path)).mode & 0o777).toBe(0o600);
  });

  it("preserves caller cancellation and performs no output save", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn((_url: any, init: RequestInit = {}) => new Promise<Response>((_resolve, reject) => {
      init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
    }));
    const pending = executeXaiImageEdit({
      credential: { kind: "oauth-session", token: "token" },
      input: input(),
      workspaceRoot,
      sessionManager: sessionManager(),
      signal: controller.signal,
    }, { codec, fetch: fetchMock });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ code: "cancelled" });
    await expect(lstat(imageEditOutputRoot(sessionManager()))).rejects.toThrow();
  });

  it("aborts a timed-out request", async () => {
    let requestSignal: AbortSignal | undefined;
    const fetchMock = vi.fn((_url: any, init: RequestInit = {}) => new Promise<Response>((_resolve, reject) => {
      requestSignal = init.signal as AbortSignal;
      init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
    }));
    await expect(executeXaiImageEdit({
      credential: { kind: "oauth-session", token: "token" },
      input: input(),
      workspaceRoot,
      sessionManager: sessionManager(),
    }, { codec, fetch: fetchMock, requestTimeoutMs: 5 })).rejects.toMatchObject({ code: "timeout" });
    expect(requestSignal?.aborted).toBe(true);
  });

  it("redacts hostile HTTP bodies, prompt, source data, and bearer", async () => {
    const hostile = `secret-token make it blue ${dataUrl}`;
    const error = await executeXaiImageEdit({
      credential: { kind: "oauth-session", token: "secret-token" },
      input: input(),
      workspaceRoot,
      sessionManager: sessionManager(),
    }, dependencies(jsonResponse({ error: hostile }, 400, { "x-request-id": "safe-id" }))).catch((value) => value);
    expect(error).toMatchObject({ code: "http_failure", status: 400 });
    expect(String(error)).toContain("safe-id");
    expect(String(error)).not.toContain("secret-token");
    expect(String(error)).not.toContain("make it blue");
    expect(String(error)).not.toContain(dataUrl);
  });

  it("rejects oversized response JSON before parsing", async () => {
    await expect(executeXaiImageEdit({
      credential: { kind: "oauth-session", token: "token" },
      input: input(),
      workspaceRoot,
      sessionManager: sessionManager(),
    }, {
      ...dependencies(new Response("x".repeat(65), { status: 200 })),
      responseMaxBytes: 64,
    })).rejects.toMatchObject({ code: "invalid_response" });
  });

  it("verifies and persists a real JPEG response with the matching extension", async () => {
    const jpeg = await readFile("preview.jpeg");
    const fetchMock = vi.fn(async () => jsonResponse({
      data: [{ b64_json: jpeg.toString("base64") }],
    }));
    const output = await executeXaiImageEdit({
      credential: { kind: "oauth-session", token: "token" },
      input: input(),
      workspaceRoot,
      sessionManager: sessionManager(),
    }, { fetch: fetchMock });
    expect(output).toMatchObject({
      mimeType: "image/jpeg",
      width: 1672,
      height: 941,
      byteLength: jpeg.length,
    });
    expect(output.path).toMatch(/\.jpg$/);
  });

  it.each([
    ["missing data", {}],
    ["empty data", { data: [] }],
    ["multiple data", { data: [{ b64_json: png.toString("base64") }, { b64_json: png.toString("base64") }] }],
    ["URL-only output", { data: [{ url: "https://example.test/image.png" }] }],
    ["malformed base64", { data: [{ b64_json: "%%%%" }] }],
    ["unsupported MIME", { data: [{ b64_json: Buffer.from("GIF89a").toString("base64") }] }],
    ["oversized dimensions", { data: [{ b64_json: pngHeaderBytes(4097, 1).toString("base64") }] }],
    [
      "oversized pixels",
      { data: [{ b64_json: pngHeaderBytes(4000, Math.floor(IMAGE_EDIT_MAX_OUTPUT_PIXELS / 4000) + 1).toString("base64") }] },
    ],
    [
      "oversized decoded bytes",
      { data: [{ b64_json: Buffer.concat([png, Buffer.alloc(IMAGE_EDIT_MAX_OUTPUT_BYTES)]).toString("base64") }] },
    ],
  ])("rejects %s without saving", async (_label, body) => {
    await expect(executeXaiImageEdit({
      credential: { kind: "oauth-session", token: "token" },
      input: input(),
      workspaceRoot,
      sessionManager: sessionManager(),
    }, dependencies(jsonResponse(body)))).rejects.toMatchObject({ code: "invalid_response" });
  });
});
