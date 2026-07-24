import { MEDIA_MAX_DATA_URL_CHARS, MEDIA_MAX_SOURCE_BYTES, MEDIA_MAX_SOURCE_PIXELS } from "./constants";
import { inspectSupportedImageBytes } from "./image-info";
import type { SupportedImageMimeType, VerifiedImageBytes } from "./types";

const STRICT_BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const STRICT_IMAGE_DATA_URL = /^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/]*={0,2})$/;

/** Decode canonical standard base64 without accepting whitespace, base64url, or bad padding. */
export function decodeStrictBase64(value: string, maxChars: number, maxBytes: number): Buffer {
  if (typeof value !== "string" || value.length === 0) throw new Error("Image base64 is empty.");
  if (value.length > maxChars) throw new Error("Image base64 exceeds the encoded-size limit.");
  if (!STRICT_BASE64.test(value)) throw new Error("Image base64 is malformed.");
  const decoded = Buffer.from(value, "base64");
  if (decoded.length === 0 || decoded.length > maxBytes) {
    throw new Error("Image exceeds the decoded-byte limit.");
  }
  if (decoded.toString("base64") !== value) throw new Error("Image base64 is not canonical.");
  return decoded;
}

/** Parse a strict, bounded PNG/JPEG data URL and verify its declared MIME from bytes. */
export function parseBoundedImageDataUrl(value: string): VerifiedImageBytes {
  if (typeof value !== "string" || value.length > MEDIA_MAX_DATA_URL_CHARS) {
    throw new Error("Image data URL exceeds the encoded-size limit.");
  }
  const match = STRICT_IMAGE_DATA_URL.exec(value);
  if (!match) throw new Error("Only strict base64 PNG and JPEG data URLs are supported.");
  const declaredMime = match[1] as SupportedImageMimeType;
  const bytes = decodeStrictBase64(match[2], MEDIA_MAX_DATA_URL_CHARS, MEDIA_MAX_SOURCE_BYTES);
  const inspected = inspectSupportedImageBytes(bytes, { maxPixels: MEDIA_MAX_SOURCE_PIXELS });
  if (inspected.mimeType !== declaredMime) throw new Error("Image data URL MIME does not match its bytes.");
  return { bytes, ...inspected, source: "data-url" };
}

/** Serialize verified PNG/JPEG bytes as a canonical data URL. */
export function toImageDataUrl(image: Pick<VerifiedImageBytes, "bytes" | "mimeType">): string {
  return `data:${image.mimeType};base64,${image.bytes.toString("base64")}`;
}
