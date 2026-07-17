import { lstat, mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CURATED_FALLBACK_MODELS,
  KNOWN_XAI_MODEL_METADATA,
  setXaiRuntimeModels,
} from "../../extensions/xai/models";
import {
  registerCursorToolShims,
  syncCursorToolShimsForModel,
} from "../../extensions/xai/tools/cursor-shims";
import { setXaiNetworkToolActive } from "../../extensions/xai/tools/model-scope";
import { createExtensionHarness } from "../fixtures/extension-api";
import { authContext, TEST_MODEL } from "../fixtures/models";
import { jsonResponse, requestBody } from "../fixtures/http";
import { createTempDir } from "../fixtures/temp";
let temp: Awaited<ReturnType<typeof createTempDir>>;
let h: ReturnType<typeof createExtensionHarness>;
let requests: Array<{ url: string; init: RequestInit; body: any }>;
beforeEach(async () => {
  temp = await createTempDir("pi-xai-shims-");
  h = createExtensionHarness();
  requests = [];
  setXaiRuntimeModels(KNOWN_XAI_MODEL_METADATA);
  registerCursorToolShims(h.api);
  await mkdir(join(temp.path, "src"));
  await writeFile(
    join(temp.path, "src/a.ts"),
    "first\nexport const VALUE = 1;\nlast\n",
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
  setXaiRuntimeModels(CURATED_FALLBACK_MODELS);
  await temp.cleanup();
});
async function run(name: string, params: any) {
  return h.tools
    .get(name)
    .execute("call", params, new AbortController().signal, () => {}, {
      cwd: temp.path,
    });
}

describe("Cursor/Grok CLI shims", () => {
  it("registers every compatibility tool", () => {
    expect([...h.tools.keys()]).toEqual([
      "Read",
      "Write",
      "StrReplace",
      "Edit",
      "Delete",
      "LS",
      "Grep",
      "Glob",
      "Shell",
      "WebSearch",
    ]);
  });
  it("maps Grep aliases, context output, schema, and pattern preparation", async () => {
    const result = await run("Grep", {
      query: "VALUE",
      include: "*.ts",
      path: "src",
      context: 1,
      limit: 1,
    });
    expect(result.content[0].text).toMatch(/a\.ts-1- first/);
    expect(result.content[0].text).toMatch(/a\.ts:2: export const VALUE/);
    const tool = h.tools.get("Grep");
    expect(
      tool.prepareArguments({ query: "VALUE", include: "*.ts" }),
    ).toMatchObject({ pattern: "VALUE", glob: "*.ts" });
    expect(tool.parameters.required).toContain("pattern");
    expect(tool.parameters.properties).toHaveProperty("query");
  });
  it("rejects unsafe, missing, whitespace, and invalid regular expressions", async () => {
    await expect(run("Grep", { query: "(a+)+$", path: "src" })).rejects.toThrow(
      /Unsafe regex/,
    );
    await expect(run("Grep", { path: "src" })).rejects.toThrow(
      /requires a non-empty pattern/,
    );
    await expect(run("Grep", { pattern: "   ", path: "src" })).rejects.toThrow(
      /requires a non-empty pattern/,
    );
    await expect(run("Grep", { pattern: "[", path: "src" })).rejects.toThrow(
      /Invalid regex/,
    );
  });
  it("maps Read, Write, Replace, Glob, Shell, and Delete to local tools", async () => {
    expect(
      (await run("Read", { file_path: "src/a.ts" })).content[0].text,
    ).toMatch(/VALUE/);
    expect((await run("Glob", { glob: "**/*.ts" })).content[0].text).toMatch(
      /src\/a\.ts/,
    );
    expect(
      (await run("Write", { file_path: "out.txt", contents: "old" })).content[0]
        .text,
    ).toMatch(/Successfully wrote/);
    expect(
      (
        await run("StrReplace", {
          file_path: "out.txt",
          old_string: "old",
          new_string: "new",
        })
      ).content[0].text,
    ).toMatch(/Successfully replaced/);
    expect(await readFile(join(temp.path, "out.txt"), "utf8")).toBe("new");
    expect(
      (await run("Shell", { cmd: "printf shim-ok" })).content[0].text,
    ).toMatch(/shim-ok/);
    expect(
      (await run("Delete", { file_path: "out.txt" })).content[0].text,
    ).toMatch(/Deleted/);
    await mkdir(join(temp.path, "nested"));
    await writeFile(join(temp.path, "nested/child.txt"), "child");
    expect(
      (await run("Delete", { path: "nested", recursive: true })).content[0]
        .text,
    ).toMatch(/Deleted/);
    await expect(lstat(join(temp.path, "nested"))).rejects.toThrow();
  });
  it("refuses Delete on the workspace root even with recursive=true", async () => {
    await writeFile(join(temp.path, "keep.txt"), "important");
    for (const path of [".", "./", temp.path]) {
      await expect(
        run("Delete", { path, recursive: true }),
      ).rejects.toThrow(/workspace root/);
    }
    expect(await readFile(join(temp.path, "keep.txt"), "utf8")).toBe(
      "important",
    );
    expect(await readFile(join(temp.path, "src/a.ts"), "utf8")).toMatch(
      /VALUE/,
    );
  });
  it("refuses Delete through intermediate links to the workspace root or an outside target", async () => {
    const outside = await createTempDir("pi-xai-shims-outside-");
    const linkType = process.platform === "win32" ? "junction" : "dir";
    try {
      await writeFile(join(temp.path, "keep.txt"), "important");
      await writeFile(join(outside.path, "victim.txt"), "outside");
      await symlink(dirname(temp.path), join(temp.path, "parent-link"), linkType);
      await symlink(outside.path, join(temp.path, "outside-link"), linkType);

      await expect(
        run("Delete", {
          path: `parent-link/${basename(temp.path)}`,
          recursive: true,
        }),
      ).rejects.toThrow(/outside the workspace|workspace root/);
      await expect(
        run("Delete", { path: "outside-link/victim.txt" }),
      ).rejects.toThrow(/outside the workspace/);

      expect(await readFile(join(temp.path, "keep.txt"), "utf8")).toBe(
        "important",
      );
      expect(await readFile(join(outside.path, "victim.txt"), "utf8")).toBe(
        "outside",
      );
    } finally {
      await outside.cleanup();
    }
  });
  it("deletes a final symlink without deleting its outside target", async () => {
    const outside = await createTempDir("pi-xai-shims-target-");
    const link = join(temp.path, "outside-link.txt");
    try {
      await writeFile(join(outside.path, "target.txt"), "outside");
      await symlink(join(outside.path, "target.txt"), link, "file");

      await expect(
        run("Delete", { path: "outside-link.txt" }),
      ).resolves.toMatchObject({
        content: [{ type: "text", text: "Deleted outside-link.txt" }],
      });
      await expect(lstat(link)).rejects.toThrow();
      expect(await readFile(join(outside.path, "target.txt"), "utf8")).toBe(
        "outside",
      );
    } finally {
      await outside.cleanup();
    }
  });
  it.runIf(process.platform === "win32")(
    "refuses a case-variant absolute workspace root",
    async () => {
      const caseVariant = temp.path.replace(/[A-Za-z]/, (character) =>
        character === character.toUpperCase()
          ? character.toLowerCase()
          : character.toUpperCase(),
      );
      expect(caseVariant).not.toBe(temp.path);
      await expect(
        run("Delete", { path: caseVariant, recursive: true }),
      ).rejects.toThrow(/workspace root/);
      expect(await readFile(join(temp.path, "src/a.ts"), "utf8")).toMatch(
        /VALUE/,
      );
    },
  );
  it("keeps WebSearch disabled until opt-in, routes Grok Build calls, and blocks stale contexts", async () => {
    const build = { ...TEST_MODEL, id: "grok-build" } as any;
    const controller = new AbortController();
    const disabled = await h.tools
      .get("WebSearch")
      .execute("call", { query: "must opt in" }, controller.signal, () => {}, {
        cwd: temp.path,
        ...authContext(build),
      });
    expect(disabled.content[0].text).toMatch(/WebSearch is disabled/);
    expect(requests).toHaveLength(0);

    expect(setXaiNetworkToolActive(h.api, build, "WebSearch", true)).toEqual(
      { ok: true, active: true },
    );
    const enabled = await h.tools
      .get("WebSearch")
      .execute("call", { query: "xAI docs" }, controller.signal, () => {}, {
        cwd: temp.path,
        ...authContext(build),
      });
    expect(enabled.content[0].text).toBe("OK");
    expect(requests).toHaveLength(1);
    expect(requests[0].body.model).toBe("grok-build");

    const stale = await h.tools
      .get("WebSearch")
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
    expect(stale.content[0].text).toMatch(/requires an active entitled xAI Grok Build model|requires an active xAI/);
    expect(requests).toHaveLength(1);
  });

  it("activates local shims only for Grok Build without duplication", () => {
    h.setActiveTools(["read", "bash", "edit", "write"]);
    syncCursorToolShimsForModel(h.api, {
      ...TEST_MODEL,
      id: "grok-build",
    } as any);
    const first = h.getActiveTools();
    expect(first).toContain("Grep");
    expect(first).not.toContain("WebSearch");
    syncCursorToolShimsForModel(h.api, {
      ...TEST_MODEL,
      id: "grok-build",
    } as any);
    expect(h.getActiveTools()).toEqual(first);
    // Composer alias and standard Grok 4.5 stay on pi tools.
    syncCursorToolShimsForModel(h.api, {
      ...TEST_MODEL,
      id: "grok-composer-2.5-fast",
    } as any);
    expect(h.getActiveTools()).not.toContain("Grep");
    syncCursorToolShimsForModel(h.api, TEST_MODEL);
    expect(h.getActiveTools()).not.toContain("Grep");
  });
  it("tolerates registry failures without partial activation", () => {
    h.setActiveTools(["read", "bash", "edit", "write"]);
    h.failRegistry({ get: true });
    expect(() =>
      syncCursorToolShimsForModel(h.api, {
        ...TEST_MODEL,
        id: "grok-build",
      } as any),
    ).not.toThrow();
    h.failRegistry({ get: false, set: true });
    syncCursorToolShimsForModel(h.api, {
      ...TEST_MODEL,
      id: "grok-build",
    } as any);
    expect(h.getActiveTools()).not.toContain("Grep");
  });
});
