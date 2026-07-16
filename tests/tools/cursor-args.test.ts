import { describe, expect, it } from "vitest";
import {
  normalizeDeleteArgs,
  normalizeEditArgs,
  normalizeGlobArgs,
  normalizeGrepArgs,
  normalizeReadArgs,
  normalizeShellArgs,
  normalizeWriteArgs,
  objectFromCursorArgs,
  safeWorkspacePath,
} from "../../extensions/xai/tools/cursor-args";

describe("Cursor argument normalization", () => {
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
});
