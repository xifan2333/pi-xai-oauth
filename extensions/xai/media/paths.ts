import { constants } from "node:fs";
import { open, realpath, stat as fsStat } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { MEDIA_MAX_SOURCE_BYTES, MEDIA_MAX_SOURCE_PIXELS } from "./constants";
import { inspectSupportedImageBytes } from "./image-info";
import type { VerifiedImageBytes } from "./types";

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("The operation was cancelled.", "AbortError");
}

function isContainedPath(root: string, target: string): boolean {
  const difference = relative(root, target);
  return difference !== "" && difference !== ".." && !difference.startsWith(`..${sep}`)
    && !isAbsolute(difference);
}

async function readHandleBounded(
  handle: Awaited<ReturnType<typeof open>>,
  maxBytes: number,
  signal?: AbortSignal,
): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;
  while (total <= maxBytes) {
    throwIfAborted(signal);
    const chunk = Buffer.allocUnsafe(Math.min(64 * 1024, maxBytes + 1 - total));
    const { bytesRead } = await handle.read(chunk, 0, chunk.length, null);
    if (bytesRead === 0) break;
    chunks.push(chunk.subarray(0, bytesRead));
    total += bytesRead;
  }
  if (total > maxBytes) throw new Error("Image reference exceeds the source-byte limit.");
  return Buffer.concat(chunks, total);
}

/** Read a byte-bounded regular image whose resolved path remains inside the workspace. */
export async function readBoundedWorkspaceImageFile(
  inputPath: string,
  workspaceRoot: string,
  signal?: AbortSignal,
): Promise<VerifiedImageBytes> {
  if (typeof inputPath !== "string" || !inputPath.trim() || inputPath.includes("\0")) {
    throw new Error("Image reference path is invalid.");
  }
  if (typeof workspaceRoot !== "string" || !workspaceRoot.trim()) {
    throw new Error("Workspace root is unavailable.");
  }
  throwIfAborted(signal);

  let root: string;
  let target: string;
  try {
    root = await realpath(workspaceRoot);
    const candidate = isAbsolute(inputPath) ? resolve(inputPath) : resolve(root, inputPath);
    target = await realpath(candidate);
  } catch {
    throw new Error("Image reference is not a readable workspace file.");
  }
  if (!isContainedPath(root, target)) throw new Error("Image reference resolves outside the workspace.");

  const noFollow = typeof constants.O_NOFOLLOW === "number" ? constants.O_NOFOLLOW : 0;
  const nonBlock = typeof constants.O_NONBLOCK === "number" ? constants.O_NONBLOCK : 0;
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  try {
    const initialStat = await fsStat(target);
    if (!initialStat.isFile()) throw new Error("Image reference must be a regular file.");
    handle = await open(target, constants.O_RDONLY | noFollow | nonBlock);
    const stat = await handle.stat();
    if (!stat.isFile()) throw new Error("Image reference must be a regular file.");
    if (stat.size <= 0) throw new Error("Image reference contains no data.");
    if (stat.size > MEDIA_MAX_SOURCE_BYTES) throw new Error("Image reference exceeds the source-byte limit.");
    const bytes = await readHandleBounded(handle, MEDIA_MAX_SOURCE_BYTES, signal);
    const inspected = inspectSupportedImageBytes(bytes, { maxPixels: MEDIA_MAX_SOURCE_PIXELS });
    return { bytes, ...inspected, source: "workspace-path" };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    if (
      error instanceof Error
      && /^(?:Image reference|Image |Only byte-validated|PNG image|JPEG image)/.test(error.message)
    ) throw error;
    throw new Error("Image reference is not a readable workspace file.");
  } finally {
    await handle?.close().catch(() => undefined);
  }
}
