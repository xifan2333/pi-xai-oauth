import { lookup as dnsLookup } from "node:dns/promises";
import { request as httpsRequest, type RequestOptions } from "node:https";
import { isIP } from "node:net";
import { XAI_USER_AGENT } from "./constants";
import {
  IMAGE_TO_VIDEO_DOWNLOAD_TIMEOUT_MS,
  IMAGE_TO_VIDEO_MAX_DOWNLOAD_URL_CHARS,
  IMAGE_TO_VIDEO_MAX_OUTPUT_BYTES,
  IMAGE_TO_VIDEO_MP4_PREFIX_BYTES,
} from "./media/constants";
import { savePrivateStreamedOutput } from "./media/output-storage";
import type { SavedVideoOutput } from "./media/types";
import { Mp4StreamInspector, validateMp4Prefix } from "./media/video-info";

export class VideoDownloadError extends Error {
  constructor(message = "xAI video download failed safely.") {
    super(message);
    this.name = "VideoDownloadError";
  }
}

interface AddressRecord {
  address: string;
  family: number;
}

export interface VideoDownloadDependencies {
  lookup?: typeof dnsLookup;
  request?: typeof httpsRequest;
  timeoutMs?: number;
  maxBytes?: number;
}

function normalizedIp(value: string): string {
  return value.toLowerCase().replace(/^::ffff:/, "");
}

function blockedIpv4(address: string): boolean {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b] = parts;
  const [, , c] = parts;
  return a === 0 || a === 10 || a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224;
}

function isBlockedVideoDownloadIpv4(address: string): boolean {
  const normalized = normalizedIp(address);
  const compatibleIpv4 = /^::(\d{1,3}(?:\.\d{1,3}){3})$/.exec(normalized)?.[1];
  if (compatibleIpv4) return blockedIpv4(compatibleIpv4);
  return isIP(normalized) === 4 && blockedIpv4(normalized);
}

export function isPublicVideoDownloadAddress(address: string): boolean {
  const normalized = normalizedIp(address);
  const compatibleIpv4 = /^::(\d{1,3}(?:\.\d{1,3}){3})$/.exec(normalized)?.[1];
  if (compatibleIpv4) return !blockedIpv4(compatibleIpv4);
  const family = isIP(normalized);
  if (family === 4) return !blockedIpv4(normalized);
  // Fail closed on IPv6 DNS answers. Correctly classifying every IANA special-
  // purpose and IPv4-transition range without a reviewed IP parser is unsafe;
  // public IPv4 CDN answers remain supported and connection-pinned.
  if (family === 6) return false;
  return false;
}

function safeVideoUrl(value: string): URL {
  if (typeof value !== "string" || !value || value.length > IMAGE_TO_VIDEO_MAX_DOWNLOAD_URL_CHARS) {
    throw new VideoDownloadError();
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new VideoDownloadError();
  }
  if (
    url.protocol !== "https:" || url.username || url.password || url.hash ||
    (url.port && url.port !== "443") || !url.hostname || isIP(url.hostname)
  ) throw new VideoDownloadError();
  return url;
}

function acceptedMime(value: string | undefined): "video/mp4" | "application/mp4" {
  const mime = value?.split(";", 1)[0]?.trim().toLowerCase();
  if (mime === "video/mp4" || mime === "application/mp4") return mime;
  throw new VideoDownloadError("xAI video download returned an unsupported media type.");
}

/** Download one temporary video URL without auth and atomically store a bounded MP4. */
export async function downloadXaiVideo(options: {
  url: string;
  outputRoot: string;
  sessionRoot: string;
  duration: 6 | 10;
  resolution: "480p" | "720p";
  signal?: AbortSignal;
}, dependencies: VideoDownloadDependencies = {}): Promise<SavedVideoOutput> {
  const url = safeVideoUrl(options.url);
  const lookup = dependencies.lookup ?? dnsLookup;
  const request = dependencies.request ?? httpsRequest;
  const controller = new AbortController();
  const forwardAbort = () => controller.abort();
  options.signal?.addEventListener("abort", forwardAbort, { once: true });
  if (options.signal?.aborted) controller.abort();
  const timeout = setTimeout(() => controller.abort(), dependencies.timeoutMs ?? IMAGE_TO_VIDEO_DOWNLOAD_TIMEOUT_MS);
  try {
    const addresses = await Promise.race([
      lookup(url.hostname, { all: true, verbatim: true }) as Promise<AddressRecord[]>,
      new Promise<never>((_resolve, reject) => controller.signal.addEventListener(
        "abort",
        () => reject(new DOMException("Cancelled", "AbortError")),
        { once: true },
      )),
    ]);
    // IPv6 answers are intentionally non-public, but dual-stack CDNs almost always
    // return mixed A/AAAA records. Select only public IPv4 pins and still fail closed
    // when any private/special-use IPv4 answer is present (DNS rebinding defense).
    const publicAddresses = addresses.filter(({ address }) => isPublicVideoDownloadAddress(address));
    const hasBlockedIpv4 = addresses.some(({ address }) => isBlockedVideoDownloadIpv4(address));
    if (publicAddresses.length === 0 || hasBlockedIpv4) {
      throw new VideoDownloadError();
    }
    const selected = publicAddresses[0];
    const response = await new Promise<import("node:http").IncomingMessage>((resolve, reject) => {
      // Node 24 enables Happy Eyeballs by default; pin family 4 and supply both
      // single-address and { all: true } lookup callback shapes so the custom pin
      // is honored without re-resolving dual-stack DNS.
      const requestOptions = {
        protocol: "https:",
        hostname: url.hostname,
        port: 443,
        path: `${url.pathname}${url.search}`,
        method: "GET",
        headers: {
          Accept: "video/mp4, application/mp4",
          "User-Agent": XAI_USER_AGENT,
        },
        servername: url.hostname,
        family: 4,
        autoSelectFamily: false,
        signal: controller.signal,
        lookup(_hostname: string, options: unknown, callback: (...args: any[]) => void) {
          const opts = typeof options === "object" && options ? options as { all?: boolean } : {};
          if (opts.all) {
            callback(null, [{ address: selected.address, family: selected.family }]);
            return;
          }
          callback(null, selected.address, selected.family);
        },
      } as RequestOptions & { autoSelectFamily?: boolean };
      const req = request(requestOptions, (res) => resolve(res));
      req.once("socket", (socket) => {
        socket.once("secureConnect", () => {
          if (normalizedIp(socket.remoteAddress ?? "") !== normalizedIp(selected.address)) {
            req.destroy(new VideoDownloadError());
          }
        });
      });
      req.once("error", reject);
      req.end();
    });
    if ((response.statusCode ?? 0) < 200 || (response.statusCode ?? 0) >= 300) {
      response.destroy();
      throw new VideoDownloadError();
    }
    let mimeType: "video/mp4" | "application/mp4";
    try {
      mimeType = acceptedMime(Array.isArray(response.headers["content-type"])
        ? response.headers["content-type"][0]
        : response.headers["content-type"]);
    } catch (error) {
      response.destroy();
      throw error;
    }
    const maxBytes = dependencies.maxBytes ?? IMAGE_TO_VIDEO_MAX_OUTPUT_BYTES;
    const declared = Number(response.headers["content-length"]);
    if (Number.isFinite(declared) && (declared <= 0 || declared > maxBytes)) {
      response.destroy();
      throw new VideoDownloadError("xAI video download exceeded the byte limit.");
    }
    const saved = await savePrivateStreamedOutput({
      outputRoot: options.outputRoot,
      sessionRoot: options.sessionRoot,
      extension: "mp4",
      stemPrefix: "xai-video",
      signal: controller.signal,
      async write(writer) {
        let total = 0;
        let prefix = Buffer.alloc(0);
        const structure = new Mp4StreamInspector();
        for await (const chunk of response) {
          if (controller.signal.aborted) throw new DOMException("Cancelled", "AbortError");
          const bytes = Buffer.from(chunk);
          total += bytes.length;
          if (total > maxBytes) {
            response.destroy();
            throw new VideoDownloadError("xAI video download exceeded the byte limit.");
          }
          if (prefix.length < IMAGE_TO_VIDEO_MP4_PREFIX_BYTES) {
            prefix = Buffer.concat([
              prefix,
              bytes.subarray(0, IMAGE_TO_VIDEO_MP4_PREFIX_BYTES - prefix.length),
            ]);
          }
          structure.push(bytes);
          await writer.write(bytes);
        }
        if (total === 0) throw new VideoDownloadError();
        validateMp4Prefix(prefix);
        structure.finish();
        return total;
      },
    });
    return {
      path: saved.path,
      mimeType,
      byteLength: saved.value,
      duration: options.duration,
      resolution: options.resolution,
    };
  } catch (error) {
    if (options.signal?.aborted) throw new VideoDownloadError("Local video download was cancelled; the remote xAI video job may continue consuming usage or credits.");
    if (controller.signal.aborted) throw new VideoDownloadError("xAI video download timed out.");
    throw error instanceof VideoDownloadError ? error : new VideoDownloadError();
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", forwardAbort);
  }
}
