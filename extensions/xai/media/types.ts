import type { SUPPORTED_IMAGE_MIME_TYPES } from "./constants";

export type SupportedImageMimeType = (typeof SUPPORTED_IMAGE_MIME_TYPES)[number];

export interface VerifiedImageBytes {
  bytes: Buffer;
  mimeType: SupportedImageMimeType;
  width: number;
  height: number;
  source: "workspace-path" | "data-url" | "compressed" | "output";
}

export interface PreparedImageReference {
  dataUrl: string;
  mimeType: SupportedImageMimeType;
  byteLength: number;
  width: number;
  height: number;
  wasCompressed: boolean;
}

export interface SavedImageOutput {
  path: string;
  mimeType: SupportedImageMimeType;
  width: number;
  height: number;
  byteLength: number;
}
