import type { SupportedImageMimeType } from "./types";

export interface ImageInspectionLimits {
  maxPixels: number;
  maxSidePx?: number;
}

export interface InspectedImage {
  mimeType: SupportedImageMimeType;
  width: number;
  height: number;
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_START_OF_FRAME_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

function validateDimensions(width: number, height: number, limits: ImageInspectionLimits) {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0) {
    throw new Error("Image dimensions are invalid.");
  }
  if (!Number.isSafeInteger(limits.maxPixels) || limits.maxPixels <= 0) {
    throw new Error("Image pixel budget is invalid.");
  }
  if (width > Math.floor(limits.maxPixels / height)) {
    throw new Error("Image exceeds the decoded-pixel limit.");
  }
  if (limits.maxSidePx !== undefined && Math.max(width, height) > limits.maxSidePx) {
    throw new Error("Image exceeds the dimension limit.");
  }
}

function inspectPng(bytes: Buffer): InspectedImage | undefined {
  if (bytes.length < 24 || !bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    return undefined;
  }
  if (bytes.readUInt32BE(8) !== 13 || bytes.toString("ascii", 12, 16) !== "IHDR") {
    throw new Error("PNG image has an invalid IHDR header.");
  }
  return {
    mimeType: "image/png",
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

function inspectJpeg(bytes: Buffer): InspectedImage | undefined {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return undefined;

  let offset = 2;
  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff) throw new Error("JPEG image contains an invalid marker.");
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    if (offset >= bytes.length) break;
    const marker = bytes[offset++];

    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > bytes.length) throw new Error("JPEG image has a truncated segment.");

    const segmentLength = bytes.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > bytes.length) {
      throw new Error("JPEG image has an invalid segment length.");
    }
    if (JPEG_START_OF_FRAME_MARKERS.has(marker)) {
      if (segmentLength < 7) throw new Error("JPEG image has a truncated frame header.");
      return {
        mimeType: "image/jpeg",
        height: bytes.readUInt16BE(offset + 3),
        width: bytes.readUInt16BE(offset + 5),
      };
    }
    offset += segmentLength;
  }
  throw new Error("JPEG image has no supported frame header.");
}

/** Inspect PNG/JPEG bytes and enforce explicit decoded dimension limits. */
export function inspectSupportedImageBytes(
  bytes: Buffer,
  limits: ImageInspectionLimits,
): InspectedImage {
  if (!Buffer.isBuffer(bytes) || bytes.length === 0) throw new Error("Image contains no data.");
  const inspected = inspectPng(bytes) ?? inspectJpeg(bytes);
  if (!inspected) throw new Error("Only byte-validated PNG and JPEG images are supported.");
  validateDimensions(inspected.width, inspected.height, limits);
  return inspected;
}
