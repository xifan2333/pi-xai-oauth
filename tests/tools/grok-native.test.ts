import { mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWriteToolDefinition } from "@earendil-works/pi-coding-agent";
import {
  XAI_GROK_NATIVE_AUTO_TOOL_NAMES,
  XAI_GROK_NATIVE_TOOL_NAME_MAP,
  XAI_GROK_NATIVE_WEB_SEARCH_DISPATCH_NAME,
  XAI_GROK_NATIVE_WEB_SEARCH_NAME,
} from "../../extensions/xai/constants";
import {
  CURATED_FALLBACK_MODELS,
  KNOWN_XAI_MODEL_METADATA,
  setXaiRuntimeModels,
} from "../../extensions/xai/models";
import {
  registerGrokNativeTools,
  syncGrokNativeToolsForModel,
} from "../../extensions/xai/tools/grok-native";
import { setXaiNetworkToolActive } from "../../extensions/xai/tools/model-scope";
import { createExtensionHarness } from "../fixtures/extension-api";
import { authContext, TEST_MODEL } from "../fixtures/models";
import { jsonResponse, requestBody } from "../fixtures/http";
import { createTempDir } from "../fixtures/temp";

let temp: Awaited<ReturnType<typeof createTempDir>>;
let h: ReturnType<typeof createExtensionHarness>;
let requests: Array<{ url: string; init: RequestInit; body: any }>;

beforeEach(async () => {
  temp = await createTempDir("pi-xai-grok-native-");
  h = createExtensionHarness();
  requests = [];
  setXaiRuntimeModels(KNOWN_XAI_MODEL_METADATA);
  registerGrokNativeTools(h.api);
  await mkdir(join(temp.path, "src"));
  await writeFile(
    join(temp.path, "src/a.ts"),
    "first\nexport const VALUE = 1;\nconst second = 'value';\nlast\n",
  );
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: any, init: RequestInit = {}) => {
      requests.push({ url: String(url), init, body: requestBody(init) });
      return jsonResponse({ id: "resp", output_text: "OK" });
    }),
  );
});

afterEach(async () => {
  vi.unstubAllGlobals();
  setXaiRuntimeModels(CURATED_FALLBACK_MODELS);
  await temp.cleanup();
});

function dispatchName(name: string): string {
  return Object.entries(XAI_GROK_NATIVE_TOOL_NAME_MAP)
    .find(([, publicName]) => publicName === name)?.[0] ?? name;
}

function tool(name: string) {
  return h.tools.get(dispatchName(name));
}

async function run(name: string, params: any) {
  return tool(name).execute("call", params, new AbortController().signal, () => {}, {
    cwd: temp.path,
  });
}

describe("Grok-native tools", () => {
  it("registers only the Grok-native surface with official argument names", () => {
    expect([...h.tools.keys()]).toEqual([
      ...XAI_GROK_NATIVE_AUTO_TOOL_NAMES,
      XAI_GROK_NATIVE_WEB_SEARCH_DISPATCH_NAME,
    ]);
    expect(tool("read_file").parameters.required).toContain("target_file");
    expect(tool("read_file").parameters.properties).toHaveProperty("pages");
    expect(tool("read_file").parameters.properties.offset.type).toBe("integer");
    expect(tool("list_dir").parameters.required).toContain("target_directory");
    expect(tool("search_replace").parameters.required).toEqual(
      expect.arrayContaining(["file_path", "old_string", "new_string"]),
    );
    expect(tool("grep").parameters.properties).toHaveProperty("-C");
    expect(tool("grep").parameters.properties).not.toHaveProperty("output_mode");
    expect(tool("run_terminal_command").parameters.properties).toHaveProperty("background");
    expect(h.tools.get(XAI_GROK_NATIVE_WEB_SEARCH_DISPATCH_NAME).label).toBe(
      XAI_GROK_NATIVE_WEB_SEARCH_NAME,
    );
    for (const publicName of Object.values(XAI_GROK_NATIVE_TOOL_NAME_MAP)) {
      expect(h.tools.has(publicName)).toBe(false);
    }
    expect(h.tools.has("Read")).toBe(false);
    expect(h.tools.has("Shell")).toBe(false);
  });

  it("maps Grok grep flags, aliases, context, type filters, and limits", async () => {
    const result = await run("grep", {
      pattern: "value",
      glob: "*.ts",
      path: "src",
      type: "ts",
      "-i": true,
      "-C": 1,
      head_limit: 3,
    });
    expect(result.content[0].text).toMatch(/a\.ts-1- first/);
    expect(result.content[0].text).toMatch(/a\.ts:2: export const VALUE/);
    expect(result.content[0].text).toMatch(/3 output line limit reached/);

    const prepared = tool("grep").prepareArguments({
      query: "VALUE",
      include: "*.ts",
      context_lines: 2,
    });
    expect(prepared).toMatchObject({ pattern: "VALUE", glob: "*.ts", "-C": 2 });
    expect(tool("grep").parameters.required).toContain("pattern");
    expect(tool("grep").parameters.properties).not.toHaveProperty("query");
  });

  it("rejects unsafe, missing, invalid, and unsupported grep calls", async () => {
    await expect(run("grep", { pattern: "(a+)+$", path: "src" })).rejects.toThrow(
      /Unsafe regex/,
    );
    await expect(run("grep", { path: "src" })).rejects.toThrow(/requires a non-empty pattern/);
    await expect(run("grep", { pattern: "   ", path: "src" })).rejects.toThrow(
      /requires a non-empty pattern/,
    );
    await expect(run("grep", { pattern: "[", path: "src" })).rejects.toThrow(
      /Invalid regex/,
    );
    await expect(run("grep", { pattern: "VALUE", type: "unknown" })).rejects.toThrow(
      /Unsupported grep file type/,
    );
  });

  it("supports multiline grep and hidden output modes", async () => {
    const multiline = await run("grep", {
      pattern: "VALUE.*second",
      path: "src",
      multiline: true,
    });
    expect(multiline.content[0].text).toMatch(/a\.ts:2: export const VALUE/);
    expect(multiline.content[0].text).toMatch(/a\.ts:3: const second/);

    const count = await run("grep", {
      pattern: "value",
      path: "src",
      "-i": true,
      output_mode: "count",
    });
    expect(count.content[0].text).toMatch(/a\.ts:2/);
  });

  it("maps read_file, search_replace, list_dir, and terminal calls onto pi tools", async () => {
    expect(
      (await run("read_file", { target_file: "src/a.ts", offset: -2, limit: 1 })).content[0].text,
    ).toMatch(/last/);
    await writeFile(join(temp.path, "negative-offset.txt"), "first\nlast");
    expect(
      (await run("read_file", { target_file: "negative-offset.txt", offset: -2, limit: 1 }))
        .content[0].text,
    ).toMatch(/last/);
    expect(
      (await run("read_file", { target_file: "negative-offset.txt", offset: -1, limit: 1 }))
        .content[0].text,
    ).toBe("");

    await writeFile(join(temp.path, "out.txt"), "old");
    expect(
      (
        await run("search_replace", {
          file_path: "out.txt",
          old_string: "old",
          new_string: "new",
        })
      ).content[0].text,
    ).toMatch(/Successfully replaced/);
    expect(await readFile(join(temp.path, "out.txt"), "utf8")).toBe("new");

    expect(
      (await run("list_dir", { target_directory: "src" })).content[0].text,
    ).toMatch(/a\.ts/);
    expect(
      (
        await run("run_terminal_command", {
          command: "printf native-ok",
          description: "verify terminal mapping",
          background: false,
          timeout: 1_000,
        })
      ).content[0].text,
    ).toMatch(/native-ok/);
  });

  it("uses pi write for creation and supports replace_all", async () => {
    expect(
      (
        await run("search_replace", {
          file_path: "created.txt",
          old_string: "",
          new_string: "old old",
        })
      ).content[0].text,
    ).toMatch(/Successfully wrote/);
    await run("search_replace", {
      file_path: "created.txt",
      old_string: "old",
      new_string: "new",
      replace_all: true,
    });
    expect(await readFile(join(temp.path, "created.txt"), "utf8")).toBe("new new");

    await writeFile(join(temp.path, "crlf.txt"), "before\r\nafter\r\n");
    await run("search_replace", {
      file_path: "crlf.txt",
      old_string: "before\nafter",
      new_string: "changed",
    });
    expect(await readFile(join(temp.path, "crlf.txt"), "utf8")).toBe("changed\r\n");

    await writeFile(join(temp.path, "mixed.txt"), "before\r\nold\nafter\r\n");
    await run("search_replace", {
      file_path: "mixed.txt",
      old_string: "old",
      new_string: "new",
    });
    expect(await readFile(join(temp.path, "mixed.txt"), "utf8")).toBe(
      "before\r\nnew\nafter\r\n",
    );

    await writeFile(join(temp.path, "bom.txt"), "\ufeffold\r\n");
    await run("search_replace", {
      file_path: "bom.txt",
      old_string: "old",
      new_string: "new",
    });
    expect(await readFile(join(temp.path, "bom.txt"), "utf8")).toBe("\ufeffnew\r\n");

    await writeFile(join(temp.path, "duplicate.txt"), "same same");
    await expect(run("search_replace", {
      file_path: "duplicate.txt",
      old_string: "same",
      new_string: "changed",
    })).rejects.toThrow(/found 2 occurrences/);
  });

  it("checks concurrent changes inside pi's file mutation queue", async () => {
    await writeFile(join(temp.path, "concurrent.txt"), "old");
    let releaseWrite!: () => void;
    const releaseWritePromise = new Promise<void>((resolve) => {
      releaseWrite = resolve;
    });
    let markWriteEntered!: () => void;
    const writeEntered = new Promise<void>((resolve) => {
      markWriteEntered = resolve;
    });
    const blockingWrite = createWriteToolDefinition(temp.path, {
      operations: {
        mkdir: () => Promise.resolve(),
        async writeFile(absolutePath, content) {
          markWriteEntered();
          await releaseWritePromise;
          await writeFile(absolutePath, content, "utf8");
        },
      },
    }).execute(
      "blocking-write",
      { path: "concurrent.txt", content: "external change" },
      undefined,
      () => {},
      { cwd: temp.path } as any,
    );
    await writeEntered;

    const replacement = run("search_replace", {
      file_path: "concurrent.txt",
      old_string: "old",
      new_string: "replacement",
    });
    const replacementAssertion = expect(replacement).rejects.toThrow(/concurrently changed file/);
    await new Promise((resolve) => setTimeout(resolve, 25));
    releaseWrite();

    await blockingWrite;
    await replacementAssertion;
    expect(await readFile(join(temp.path, "concurrent.txt"), "utf8")).toBe("external change");
  });

  it("rejects background terminal calls instead of silently foregrounding them", async () => {
    const marker = join(temp.path, "should-not-exist");
    await expect(
      run("run_terminal_command", {
        command: `touch ${JSON.stringify(marker)}`,
        description: "exercise the unsupported background path",
        background: true,
      }),
    ).rejects.toThrow(/background=true is unavailable/);
    await expect(readFile(marker, "utf8")).rejects.toThrow();
  });

  it("refuses an explicit grep symlink that escapes the workspace", async () => {
    const outside = await createTempDir("pi-xai-grok-outside-");
    try {
      await writeFile(join(outside.path, "secret.txt"), "DO_NOT_READ");
      await symlink(outside.path, join(temp.path, "escape"), "dir");
      await expect(run("grep", { pattern: "DO_NOT_READ", path: "escape" })).rejects.toThrow(
        /outside the workspace/,
      );
    } finally {
      await outside.cleanup();
    }
  });

  it("keeps web_search opt-in, forwards domain filters, and blocks stale contexts", async () => {
    const model = { ...TEST_MODEL, id: "grok-4.5" } as any;
    const controller = new AbortController();
    const disabled = await h.tools
      .get(XAI_GROK_NATIVE_WEB_SEARCH_DISPATCH_NAME)
      .execute("call", { query: "must opt in" }, controller.signal, () => {}, {
        cwd: temp.path,
        ...authContext(model),
      });
    expect(disabled.content[0].text).toMatch(/web_search is disabled/);
    expect(requests).toHaveLength(0);

    expect(
      setXaiNetworkToolActive(
        h.api,
        model,
        XAI_GROK_NATIVE_WEB_SEARCH_DISPATCH_NAME,
        true,
      ),
    ).toEqual({
      ok: true,
      active: true,
    });
    const enabled = await h.tools
      .get(XAI_GROK_NATIVE_WEB_SEARCH_DISPATCH_NAME)
      .execute(
        "call",
        { query: "xAI docs", allowed_domains: ["x.ai"] },
        controller.signal,
        () => {},
        { cwd: temp.path, ...authContext(model) },
      );
    expect(enabled.content[0].text).toBe("OK");
    expect(requests).toHaveLength(1);
    expect(requests[0].body).toMatchObject({
      model: "grok-4.5",
      tools: [{ type: "web_search", filters: { allowed_domains: ["x.ai"] } }],
    });

    const stale = await h.tools
      .get(XAI_GROK_NATIVE_WEB_SEARCH_DISPATCH_NAME)
      .execute(
        "call",
        { query: "must stay local" },
        controller.signal,
        () => {},
        {
          cwd: temp.path,
          ...authContext({ provider: "anthropic", id: "claude" } as any),
        },
      );
    expect(stale.content[0].text).toMatch(/requires an active xAI/);
    expect(requests).toHaveLength(1);
  });

  it("activates native local tools without mutating unrelated public tools", () => {
    const foreignNames = Object.values(XAI_GROK_NATIVE_TOOL_NAME_MAP);
    h.setActiveTools(["read", "bash", ...foreignNames]);
    syncGrokNativeToolsForModel(h.api, TEST_MODEL);
    const first = h.getActiveTools();
    for (const name of XAI_GROK_NATIVE_AUTO_TOOL_NAMES) expect(first).toContain(name);
    for (const name of foreignNames) expect(first).toContain(name);

    syncGrokNativeToolsForModel(h.api, TEST_MODEL);
    expect(h.getActiveTools()).toEqual(first);
    syncGrokNativeToolsForModel(h.api, {
      ...TEST_MODEL,
      id: "grok-composer-2.5-fast",
    } as any);
    for (const name of XAI_GROK_NATIVE_AUTO_TOOL_NAMES) {
      expect(h.getActiveTools()).toContain(name);
    }

    syncGrokNativeToolsForModel(h.api, { provider: "anthropic", id: "claude" } as any);
    for (const name of XAI_GROK_NATIVE_AUTO_TOOL_NAMES) {
      expect(h.getActiveTools()).not.toContain(name);
    }
    for (const name of foreignNames) expect(h.getActiveTools()).toContain(name);
  });

  it("tolerates registry failures without partial activation", () => {
    h.setActiveTools(["read", "bash", "edit", "write"]);
    h.failRegistry({ get: true });
    expect(() => syncGrokNativeToolsForModel(h.api, TEST_MODEL)).not.toThrow();
    h.failRegistry({ get: false, set: true });
    syncGrokNativeToolsForModel(h.api, TEST_MODEL);
    expect(h.getActiveTools()).not.toContain("xai_grok_grep");
  });
});
