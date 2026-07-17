import { execFile } from "node:child_process";
import { mkdir, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readBoundedWorkspaceImageFile } from "../../extensions/xai/media/paths";
import { createTempDir } from "../fixtures/temp";
import { tinyPngBytes } from "../fixtures/images";

const execFileAsync = promisify(execFile);

describe("bounded workspace image reads", () => {
  let temp: Awaited<ReturnType<typeof createTempDir>>;
  let workspace: string;
  let outside: string;

  beforeEach(async () => {
    temp = await createTempDir("pi-xai-media-paths-");
    workspace = join(temp.path, "workspace");
    outside = join(temp.path, "outside.png");
    await mkdir(workspace);
    await writeFile(join(workspace, "inside.png"), tinyPngBytes());
    await writeFile(outside, tinyPngBytes());
  });

  afterEach(async () => temp.cleanup());

  it("accepts relative and absolute regular files inside the real workspace", async () => {
    await expect(readBoundedWorkspaceImageFile("inside.png", workspace)).resolves.toMatchObject({
      mimeType: "image/png",
      width: 1,
      height: 1,
    });
    await expect(readBoundedWorkspaceImageFile(join(workspace, "inside.png"), workspace)).resolves.toMatchObject({
      source: "workspace-path",
    });
  });

  it("rejects lexical traversal, outside absolute paths, and outward symlinks without reflecting paths", async () => {
    await symlink(outside, join(workspace, "escape.png"));
    for (const value of ["../outside.png", outside, "escape.png"]) {
      await expect(readBoundedWorkspaceImageFile(value, workspace)).rejects.toThrow(/outside the workspace/);
      try {
        await readBoundedWorkspaceImageFile(value, workspace);
      } catch (error) {
        expect(String(error)).not.toContain(outside);
      }
    }
  });

  it("rejects parent symlink traversal, directories, missing files, NULs, and unsupported bytes", async () => {
    const externalDir = join(temp.path, "external");
    await mkdir(externalDir);
    await writeFile(join(externalDir, "image.png"), tinyPngBytes());
    await symlink(externalDir, join(workspace, "linked"));
    await writeFile(join(workspace, "fake.png"), Buffer.from("not an image"));

    await expect(readBoundedWorkspaceImageFile("linked/image.png", workspace)).rejects.toThrow(/outside/);
    await expect(readBoundedWorkspaceImageFile(".", workspace)).rejects.toThrow(/outside|regular/);
    await expect(readBoundedWorkspaceImageFile("missing.png", workspace)).rejects.toThrow(/readable/);
    await expect(readBoundedWorkspaceImageFile("bad\0.png", workspace)).rejects.toThrow(/invalid/);
    await expect(readBoundedWorkspaceImageFile("fake.png", workspace)).rejects.toThrow(/PNG and JPEG/);
  });

  it("preserves cancellation before filesystem access", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(readBoundedWorkspaceImageFile("inside.png", workspace, controller.signal)).rejects.toMatchObject({
      name: "AbortError",
    });
  });

  it.runIf(process.platform !== "win32")("rejects a FIFO without blocking", async () => {
    const fifo = join(workspace, "special.png");
    await execFileAsync("mkfifo", [fifo]);
    let timeout: NodeJS.Timeout | undefined;
    try {
      await expect(Promise.race([
        readBoundedWorkspaceImageFile("special.png", workspace),
        new Promise((_, reject) => {
          timeout = setTimeout(() => reject(new Error("FIFO rejection timed out")), 1_000);
        }),
      ])).rejects.toThrow(/regular file/);
    } finally {
      clearTimeout(timeout);
    }
  });
});
