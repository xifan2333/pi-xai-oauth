import {
  mkdirSync,
  mkdtempSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { tinyPngBytes } from "../fixtures/images";

const openHooks = vi.hoisted(() => ({
  sync: undefined as (() => void) | undefined,
  async: undefined as (() => void) | undefined,
  syncStat: undefined as (() => void) | undefined,
  asyncStat: undefined as (() => void) | undefined,
}));

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    openSync: (...args: any[]) => {
      const hook = openHooks.sync;
      openHooks.sync = undefined;
      hook?.();
      return (actual.openSync as any)(...args);
    },
    statSync: (...args: any[]) => {
      const hook = openHooks.syncStat;
      openHooks.syncStat = undefined;
      hook?.();
      return (actual.statSync as any)(...args);
    },
  };
});

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return {
    ...actual,
    open: async (...args: any[]) => {
      const hook = openHooks.async;
      openHooks.async = undefined;
      hook?.();
      return await (actual.open as any)(...args);
    },
    stat: async (...args: any[]) => {
      const hook = openHooks.asyncStat;
      openHooks.asyncStat = undefined;
      hook?.();
      return await (actual.stat as any)(...args);
    },
  };
});

import {
  readBoundedWorkspaceImageFile,
  readBoundedWorkspaceImageFileSync,
} from "../../extensions/xai/media/paths";

describe.runIf(process.platform !== "win32")("workspace image open races", () => {
  const roots: string[] = [];

  function fixture() {
    const root = mkdtempSync(join(tmpdir(), "pi-xai-media-race-"));
    roots.push(root);
    const workspace = join(root, "workspace");
    const checkedDirectory = join(workspace, "checked");
    const displacedDirectory = join(workspace, "checked-before-swap");
    const outsideDirectory = join(root, "outside");
    mkdirSync(checkedDirectory, { recursive: true });
    mkdirSync(outsideDirectory);
    writeFileSync(join(checkedDirectory, "image.png"), tinyPngBytes());
    writeFileSync(join(outsideDirectory, "image.png"), tinyPngBytes());
    return {
      workspace,
      swapIntermediateDirectory() {
        renameSync(checkedDirectory, displacedDirectory);
        symlinkSync(outsideDirectory, checkedDirectory, "dir");
      },
    };
  }

  afterEach(() => {
    openHooks.sync = undefined;
    openHooks.async = undefined;
    openHooks.syncStat = undefined;
    openHooks.asyncStat = undefined;
    for (const root of roots.splice(0)) {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects a synchronous intermediate-directory swap before reading", () => {
    const raced = fixture();
    openHooks.sync = raced.swapIntermediateDirectory;
    expect(() => readBoundedWorkspaceImageFileSync("checked/image.png", raced.workspace))
      .toThrow(/changed while being opened/);
  });

  it("rejects an asynchronous intermediate-directory swap before reading", async () => {
    const raced = fixture();
    openHooks.async = raced.swapIntermediateDirectory;
    await expect(readBoundedWorkspaceImageFile("checked/image.png", raced.workspace))
      .rejects.toThrow(/changed while being opened/);
  });

  it("rejects a synchronous directory swap before the contained path is statted", () => {
    const raced = fixture();
    openHooks.syncStat = raced.swapIntermediateDirectory;
    expect(() => readBoundedWorkspaceImageFileSync("checked/image.png", raced.workspace))
      .toThrow(/outside the workspace/);
  });

  it("rejects an asynchronous directory swap before the contained path is statted", async () => {
    const raced = fixture();
    openHooks.asyncStat = raced.swapIntermediateDirectory;
    await expect(readBoundedWorkspaceImageFile("checked/image.png", raced.workspace))
      .rejects.toThrow(/outside the workspace/);
  });
});
