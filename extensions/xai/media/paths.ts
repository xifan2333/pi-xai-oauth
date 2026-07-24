import {
  closeSync,
  constants,
  fstatSync,
  openSync,
  readSync,
  realpathSync,
  statSync,
} from "node:fs";
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

function validateWorkspacePathInputs(inputPath: string, workspaceRoot: string) {
  if (typeof inputPath !== "string" || !inputPath.trim() || inputPath.includes("\0")) {
    throw new Error("Image reference path is invalid.");
  }
  if (typeof workspaceRoot !== "string" || !workspaceRoot.trim()) {
    throw new Error("Workspace root is unavailable.");
  }
}

function shouldPreserveImageReadError(error: unknown): error is Error {
  return error instanceof Error
    && /^(?:Image reference|Image |Only byte-validated|PNG image|JPEG image)/.test(error.message);
}

function hasSameFileIdentity(
  expected: Readonly<{ dev: bigint; ino: bigint }>,
  actual: Readonly<{ dev: bigint; ino: bigint }>,
): boolean {
  return expected.dev === actual.dev && expected.ino === actual.ino;
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

function readDescriptorBounded(fd: number, maxBytes: number): Buffer {
  const chunks: Buffer[] = [];
  let total = 0;
  while (total <= maxBytes) {
    const chunk = Buffer.allocUnsafe(Math.min(64 * 1024, maxBytes + 1 - total));
    const bytesRead = readSync(fd, chunk, 0, chunk.length, null);
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
  validateWorkspacePathInputs(inputPath, workspaceRoot);
  throwIfAborted(signal);

  let root: string;
  let target: string;
  let initialStat: Awaited<ReturnType<typeof fsStat>>;
  try {
    root = await realpath(workspaceRoot);
    const candidate = isAbsolute(inputPath) ? resolve(inputPath) : resolve(root, inputPath);
    initialStat = await fsStat(candidate, { bigint: true });
    target = await realpath(candidate);
  } catch {
    throw new Error("Image reference is not a readable workspace file.");
  }
  if (!isContainedPath(root, target)) throw new Error("Image reference resolves outside the workspace.");

  const noFollow = typeof constants.O_NOFOLLOW === "number" ? constants.O_NOFOLLOW : 0;
  const nonBlock = typeof constants.O_NONBLOCK === "number" ? constants.O_NONBLOCK : 0;
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  try {
    if (!initialStat.isFile()) throw new Error("Image reference must be a regular file.");
    handle = await open(target, constants.O_RDONLY | noFollow | nonBlock);
    const stat = await handle.stat({ bigint: true });
    if (!hasSameFileIdentity(initialStat, stat)) {
      throw new Error("Image reference changed while being opened.");
    }
    if (!stat.isFile()) throw new Error("Image reference must be a regular file.");
    if (stat.size <= 0n) throw new Error("Image reference contains no data.");
    if (stat.size > BigInt(MEDIA_MAX_SOURCE_BYTES)) {
      throw new Error("Image reference exceeds the source-byte limit.");
    }
    const bytes = await readHandleBounded(handle, MEDIA_MAX_SOURCE_BYTES, signal);
    const inspected = inspectSupportedImageBytes(bytes, { maxPixels: MEDIA_MAX_SOURCE_PIXELS });
    return { bytes, ...inspected, source: "workspace-path" };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    if (shouldPreserveImageReadError(error)) throw error;
    throw new Error("Image reference is not a readable workspace file.");
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

/** Synchronously read a byte-bounded regular image whose resolved path remains inside the workspace. */
export function readBoundedWorkspaceImageFileSync(
  inputPath: string,
  workspaceRoot: string,
): VerifiedImageBytes {
  validateWorkspacePathInputs(inputPath, workspaceRoot);

  let root: string;
  let target: string;
  let initialStat: ReturnType<typeof statSync>;
  try {
    root = realpathSync(workspaceRoot);
    const candidate = isAbsolute(inputPath) ? resolve(inputPath) : resolve(root, inputPath);
    initialStat = statSync(candidate, { bigint: true });
    target = realpathSync(candidate);
  } catch {
    throw new Error("Image reference is not a readable workspace file.");
  }
  if (!isContainedPath(root, target)) throw new Error("Image reference resolves outside the workspace.");

  const noFollow = typeof constants.O_NOFOLLOW === "number" ? constants.O_NOFOLLOW : 0;
  const nonBlock = typeof constants.O_NONBLOCK === "number" ? constants.O_NONBLOCK : 0;
  let fd: number | undefined;
  try {
    if (!initialStat.isFile()) throw new Error("Image reference must be a regular file.");
    fd = openSync(target, constants.O_RDONLY | noFollow | nonBlock);
    const stat = fstatSync(fd, { bigint: true });
    if (!hasSameFileIdentity(initialStat, stat)) {
      throw new Error("Image reference changed while being opened.");
    }
    if (!stat.isFile()) throw new Error("Image reference must be a regular file.");
    if (stat.size <= 0n) throw new Error("Image reference contains no data.");
    if (stat.size > BigInt(MEDIA_MAX_SOURCE_BYTES)) {
      throw new Error("Image reference exceeds the source-byte limit.");
    }
    const bytes = readDescriptorBounded(fd, MEDIA_MAX_SOURCE_BYTES);
    const inspected = inspectSupportedImageBytes(bytes, { maxPixels: MEDIA_MAX_SOURCE_PIXELS });
    return { bytes, ...inspected, source: "workspace-path" };
  } catch (error) {
    if (shouldPreserveImageReadError(error)) throw error;
    throw new Error("Image reference is not a readable workspace file.");
  } finally {
    if (fd !== undefined) {
      try {
        closeSync(fd);
      } catch {
        // The read result or sanitized read failure remains authoritative.
      }
    }
  }
}
