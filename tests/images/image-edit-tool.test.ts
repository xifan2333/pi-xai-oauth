import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registerCustomXaiTools } from "../../extensions/xai/tools/custom-tools";
import { setXaiNetworkToolActive } from "../../extensions/xai/tools/model-scope";
import { createExtensionHarness } from "../fixtures/extension-api";
import { jsonResponse, requestBody } from "../fixtures/http";
import { tinyPngBytes } from "../fixtures/images";
import { authContext, TEST_MODEL } from "../fixtures/models";
import { createTempDir } from "../fixtures/temp";

describe("xai_edit_image tool adapter", () => {
  let temp: Awaited<ReturnType<typeof createTempDir>>;
  let workspace: string;
  let sessions: string;
  let harness: ReturnType<typeof createExtensionHarness>;
  const png = tinyPngBytes();
  const dataUrl = `data:image/png;base64,${png.toString("base64")}`;

  beforeEach(async () => {
    temp = await createTempDir("pi-xai-edit-tool-");
    workspace = join(temp.path, "workspace");
    sessions = join(temp.path, "sessions");
    await Promise.all([mkdir(workspace), mkdir(sessions)]);
    harness = createExtensionHarness();
    registerCustomXaiTools(harness.api);
    setXaiNetworkToolActive(harness.api, TEST_MODEL, "xai_edit_image", true);
  });
  afterEach(async () => temp.cleanup());

  function context() {
    return {
      ...authContext(),
      cwd: workspace,
      sessionManager: {
        getSessionDir: () => sessions,
        getSessionId: () => "tool-adapter-session",
      },
    };
  }

  it("runs the enabled tool end to end and returns safe saved-file metadata", async () => {
    let body: any;
    vi.stubGlobal("fetch", vi.fn(async (_url: any, init: RequestInit = {}) => {
      body = requestBody(init);
      return jsonResponse({ data: [{ b64_json: png.toString("base64") }] });
    }));
    const result = await harness.tools.get("xai_edit_image").execute(
      "call",
      { prompt: "make it blue", image: [{ data_url: dataUrl }] },
      undefined,
      () => {},
      context(),
    );
    expect(body).toMatchObject({ n: 1, image: { url: dataUrl } });
    expect(result.content[0].text).toMatch(/Edited image saved/);
    expect(result.details).toMatchObject({ mimeType: "image/png", width: 1, height: 1 });
    expect(result.details).not.toHaveProperty("base64");
  });

  it("rejects invalid input before credential or filesystem context lookup", async () => {
    let credentialReads = 0;
    const result = await harness.tools.get("xai_edit_image").execute(
      "call",
      { prompt: "edit", image: [{ path: "https://example.test/a.png" }] },
      undefined,
      () => {},
      {
        model: TEST_MODEL,
        get modelRegistry() {
          credentialReads += 1;
          throw new Error("must not resolve");
        },
        get cwd() {
          throw new Error("must not inspect filesystem context");
        },
      },
    );
    expect(result.content[0].text).toMatch(/do not accept URL schemes/);
    expect(credentialReads).toBe(0);
  });

  it("returns redacted HTTP errors without reflecting prompt, data URL, or token", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({
      error: `oauth-token dangerous prompt ${dataUrl}`,
    }, 429)));
    const result = await harness.tools.get("xai_edit_image").execute(
      "call",
      { prompt: "dangerous prompt", image: [{ data_url: dataUrl }] },
      undefined,
      () => {},
      context(),
    );
    expect(result.content[0].text).toMatch(/HTTP 429/);
    expect(JSON.stringify(result)).not.toContain("oauth-token");
    expect(JSON.stringify(result)).not.toContain("dangerous prompt");
    expect(JSON.stringify(result)).not.toContain(dataUrl);
  });
});
