import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { normalizeXaiImageInput } from "../../extensions/xai/images";
import {
  MEDIA_MAX_SOURCE_BYTES,
  MEDIA_MAX_SOURCE_PIXELS,
} from "../../extensions/xai/media/constants";
import {
  jpegHeaderBytes,
  pngHeaderBytes,
  tinyPngBytes,
} from "../fixtures/images";

describe("normalizeXaiImageInput local workspace paths", () => {
  const directories: string[] = [];

  function tempDir(prefix: string): string {
    const directory = mkdtempSync(join(tmpdir(), prefix));
    directories.push(directory);
    return directory;
  }

  afterEach(() => {
    for (const directory of directories.splice(0)) {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("accepts relative, absolute, quoted, shell-escaped, and file URL workspace PNGs", () => {
    const workspace = tempDir("xai-normalize-workspace-");
    const plain = join(workspace, "plain.png");
    const spaced = join(workspace, "My Image.png");
    writeFileSync(plain, tinyPngBytes());
    writeFileSync(spaced, tinyPngBytes());

    for (const input of [
      "plain.png",
      plain,
      '"plain.png"',
      "'plain.png'",
      "My\\ Image.png",
      pathToFileURL(plain).href,
    ]) {
      expect(normalizeXaiImageInput(input, workspace)).toBe(
        `data:image/png;base64,${tinyPngBytes().toString("base64")}`,
      );
    }
  });

  it("accepts byte-valid JPEGs with jpg and jpeg extensions", () => {
    const workspace = tempDir("xai-normalize-workspace-");
    const bytes = jpegHeaderBytes(2, 3);
    writeFileSync(join(workspace, "image.jpg"), bytes);
    writeFileSync(join(workspace, "image.jpeg"), bytes);

    expect(normalizeXaiImageInput("image.jpg", workspace)).toBe(
      `data:image/jpeg;base64,${bytes.toString("base64")}`,
    );
    expect(normalizeXaiImageInput("image.jpeg", workspace)).toBe(
      `data:image/jpeg;base64,${bytes.toString("base64")}`,
    );
  });

  it("passes HTTP(S) and existing image data URLs through unchanged without a workspace", () => {
    const values = [
      "http://example.test/image.png",
      "https://example.test/image.jpg",
      `data:image/png;base64,${tinyPngBytes().toString("base64")}`,
      "data:image/jpeg;base64,not-validated-by-this-legacy-normalizer",
    ];
    for (const value of values) {
      expect(normalizeXaiImageInput(value, "")).toBe(value);
    }
  });

  it("rejects absolute paths, relative traversal, and file URLs outside the workspace", () => {
    const root = tempDir("xai-normalize-root-");
    const workspace = join(root, "workspace");
    const outside = join(root, "private-outside.png");
    mkdirSync(workspace);
    writeFileSync(outside, tinyPngBytes());
    const traversal = relative(workspace, outside);
    expect(traversal.startsWith("..")).toBe(true);

    for (const input of [outside, traversal, pathToFileURL(outside).href]) {
      expect(() => normalizeXaiImageInput(input, workspace)).toThrow(/outside the workspace/);
    }
  });

  it.runIf(process.platform !== "win32")("rejects outward leaf and intermediate symlinks", () => {
    const root = tempDir("xai-normalize-root-");
    const workspace = join(root, "workspace");
    const external = join(root, "external");
    mkdirSync(workspace);
    mkdirSync(external);
    const outside = join(external, "private.png");
    writeFileSync(outside, tinyPngBytes());
    symlinkSync(outside, join(workspace, "leaf.png"));
    symlinkSync(external, join(workspace, "linked"));

    expect(() => normalizeXaiImageInput("leaf.png", workspace)).toThrow(/outside the workspace/);
    expect(() => normalizeXaiImageInput("linked/private.png", workspace)).toThrow(/outside the workspace/);
  });

  it("rejects directories, missing and NUL paths, and unsupported extensions", () => {
    const workspace = tempDir("xai-normalize-workspace-");
    mkdirSync(join(workspace, "directory.png"));
    writeFileSync(join(workspace, "image.gif"), tinyPngBytes());

    expect(() => normalizeXaiImageInput("directory.png", workspace)).toThrow(/regular file/);
    expect(() => normalizeXaiImageInput("missing.png", workspace)).toThrow(/readable workspace file/);
    expect(() => normalizeXaiImageInput("bad\0.png", workspace)).toThrow(/invalid/);
    expect(() => normalizeXaiImageInput("image.gif", workspace)).toThrow(/local \.jpg, \.jpeg, and \.png/);
    expect(() => normalizeXaiImageInput("missing.png", "")).toThrow(/Workspace root is unavailable/);
  });

  it.runIf(process.platform !== "win32")("rejects special files without blocking", () => {
    const workspace = tempDir("xai-normalize-workspace-");
    execFileSync("mkfifo", [join(workspace, "special.png")]);
    expect(() => normalizeXaiImageInput("special.png", workspace)).toThrow(/regular file/);
  });

  it("rejects oversized files, malformed bytes, MIME spoofing, and pixel bombs", () => {
    const workspace = tempDir("xai-normalize-workspace-");
    writeFileSync(join(workspace, "oversized.png"), Buffer.alloc(MEDIA_MAX_SOURCE_BYTES + 1));
    writeFileSync(join(workspace, "malformed.png"), Buffer.from("not an image"));
    writeFileSync(join(workspace, "spoofed.jpg"), tinyPngBytes());
    writeFileSync(
      join(workspace, "pixel-bomb.png"),
      pngHeaderBytes(MEDIA_MAX_SOURCE_PIXELS + 1, 1),
    );

    expect(() => normalizeXaiImageInput("oversized.png", workspace)).toThrow(/source-byte limit/);
    expect(() => normalizeXaiImageInput("malformed.png", workspace)).toThrow(/PNG and JPEG/);
    expect(() => normalizeXaiImageInput("spoofed.jpg", workspace)).toThrow(/extension does not match/);
    expect(() => normalizeXaiImageInput("pixel-bomb.png", workspace)).toThrow(/decoded-pixel limit/);
  });

  it("never reflects supplied paths in local-image failures", () => {
    const root = tempDir("xai-normalize-redaction-");
    const workspace = join(root, "workspace");
    const outside = join(root, "SENSITIVE-outside-secret.png");
    mkdirSync(workspace);
    writeFileSync(outside, tinyPngBytes());

    for (const input of [
      outside,
      relative(workspace, outside),
      pathToFileURL(outside).href,
      "SENSITIVE-missing-secret.png",
      "SENSITIVE-unsupported-secret.gif",
    ]) {
      let error: Error | undefined;
      try {
        normalizeXaiImageInput(input, workspace);
      } catch (caught) {
        error = caught as Error;
      }
      expect(error).toBeInstanceOf(Error);
      expect(error?.message).not.toContain(input);
      expect(error?.message).not.toMatch(/SENSITIVE|outside-secret|missing-secret|unsupported-secret/);
    }
  });
});
