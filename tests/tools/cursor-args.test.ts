import { mkdir, realpath, symlink, writeFile } from "node:fs/promises";
import { join, win32 } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  normalizeDeleteArgs,
  normalizeEditArgs,
  normalizeGlobArgs,
  normalizeGrepArgs,
  normalizeReadArgs,
  normalizeShellArgs,
  normalizeWriteArgs,
  objectFromCursorArgs,
  isSameResolvedPath,
  safeWorkspaceChildPath,
  safeWorkspacePath,
} from "../../extensions/xai/tools/cursor-args";
import { createTempDir } from "../fixtures/temp";

describe("Cursor argument normalization", () => {
  let temp: Awaited<ReturnType<typeof createTempDir>>;
  let workspace: string;

  beforeEach(async () => {
    temp = await createTempDir("pi-xai-cursor-args-");
    workspace = join(temp.path, "workspace");
    await mkdir(workspace);
    await mkdir(join(temp.path, "outside"));
    await mkdir(join(workspace, "src"));
    await writeFile(join(workspace, "src/a.ts"), "inside");
  });

  afterEach(async () => temp.cleanup());

  const childPath = (requestedPath: string) =>
    Promise.resolve().then(() => safeWorkspaceChildPath(workspace, requestedPath));

  it("coerces object, JSON, and plain string arguments", () => {
    expect(objectFromCursorArgs({ path: "a" })).toEqual({ path: "a" });
    expect(objectFromCursorArgs('{"path":"a"}')).toEqual({ path: "a" });
    expect(objectFromCursorArgs("a")).toEqual({ value: "a" });
  });
  it("maps filesystem aliases", () => {
    expect(
      normalizeReadArgs({ file_path: "a", start_line: "2", max_lines: 3 }),
    ).toEqual({ path: "a", offset: 2, limit: 3 });
    expect(normalizeWriteArgs({ file_path: "a", contents: "b" })).toEqual({
      path: "a",
      content: "b",
    });
    expect(
      normalizeEditArgs({ file_path: "a", old_string: "b", new_string: "c" }),
    ).toEqual({ path: "a", edits: [{ oldText: "b", newText: "c" }] });
    expect(normalizeDeleteArgs({ file_path: "a", recursive: "yes" })).toEqual({
      path: "a",
      recursive: true,
    });
    expect(normalizeShellArgs({ cmd: "echo ok", timeout_ms: "10" })).toEqual({
      command: "echo ok",
      timeout: 10,
    });
  });
  it("maps grep and glob aliases while requiring search text", () => {
    expect(
      normalizeGrepArgs({ query: "needle", include: "*.ts", context_lines: 2 }),
    ).toMatchObject({ pattern: "needle", glob: "*.ts", context: 2 });
    expect(
      normalizeGlobArgs({ glob: "**/*.ts", directory: "src" }),
    ).toMatchObject({ pattern: "**/*.ts", path: "src" });
    expect(() => normalizeGrepArgs({ include: "*.ts" })).toThrow(
      /requires a non-empty pattern/,
    );
    expect(() => normalizeGrepArgs({ pattern: "   " })).toThrow(
      /requires a non-empty pattern/,
    );
  });
  it("refuses paths outside the workspace", () => {
    expect(safeWorkspacePath("/tmp/work", "src/a.ts")).toBe(
      "/tmp/work/src/a.ts",
    );
    expect(() => safeWorkspacePath("/tmp/work", "../secret")).toThrow(
      /outside the workspace/,
    );
  });
  it("allows the workspace root for reads but refuses it for destructive child paths", async () => {
    expect(safeWorkspacePath(workspace, ".")).toBe(workspace);
    expect(safeWorkspacePath(workspace, "./")).toBe(workspace);
    expect(safeWorkspacePath(workspace, workspace)).toBe(workspace);
    await expect(childPath("src/a.ts")).resolves.toBe(
      await realpath(join(workspace, "src/a.ts")),
    );
    for (const requested of [".", "./", workspace]) {
      await expect(childPath(requested)).rejects.toThrow(/workspace root/);
    }
  });

  it("refuses destructive paths whose intermediate link resolves outside or back to the root", async () => {
    const linkType = process.platform === "win32" ? "junction" : "dir";
    await symlink(join(temp.path, "outside"), join(workspace, "outside-link"), linkType);
    await symlink(temp.path, join(workspace, "parent-link"), linkType);

    await expect(childPath("outside-link/victim")).rejects.toThrow(/outside the workspace/);
    await expect(childPath("parent-link/workspace")).rejects.toThrow(
      /outside the workspace|workspace root/,
    );
  });

  it("treats Windows case variants as the same resolved workspace root", () => {
    const workspace = "C:\\Users\\Alice\\Work";
    for (const caseVariant of [
      "c:\\Users\\Alice\\Work",
      "C:\\Users\\alice\\work",
    ]) {
      expect(
        isSameResolvedPath(workspace, caseVariant, win32.relative),
      ).toBe(true);
    }
    expect(
      isSameResolvedPath(
        workspace,
        "C:\\Users\\Alice\\Work\\src",
        win32.relative,
      ),
    ).toBe(false);
  });

  it("preserves final-symlink unlink semantics after validating its real parent", async () => {
    const target = join(temp.path, "outside/target.txt");
    const link = join(workspace, "target-link");
    await writeFile(target, "outside");
    await symlink(target, link, "file");

    await expect(childPath("target-link")).resolves.toBe(
      join(await realpath(workspace), "target-link"),
    );
  });
});
