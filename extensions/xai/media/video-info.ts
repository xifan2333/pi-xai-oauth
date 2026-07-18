import { IMAGE_TO_VIDEO_MP4_PREFIX_BYTES } from "./constants";

const ALLOWED_MP4_BRANDS = new Set([
  "isom",
  "iso2",
  "iso3",
  "iso4",
  "iso5",
  "iso6",
  "iso7",
  "iso8",
  "iso9",
  "mp41",
  "mp42",
  "avc1",
  "M4V ",
]);

/** Validate bounded ISO-BMFF evidence from the beginning of an MP4 stream. */
export function validateMp4Prefix(prefix: Buffer): void {
  if (prefix.length < 16) throw new Error("Video output is not a valid bounded MP4.");
  const size32 = prefix.readUInt32BE(0);
  const extended = size32 === 1;
  if (prefix.toString("ascii", 4, 8) !== "ftyp" || (extended && prefix.length < 24)) {
    throw new Error("Video output is not a valid bounded MP4.");
  }
  const size = extended ? Number(prefix.readBigUInt64BE(8)) : size32;
  const contentOffset = extended ? 16 : 8;
  if (size < contentOffset + 8 || size > IMAGE_TO_VIDEO_MP4_PREFIX_BYTES || size > prefix.length) {
    throw new Error("Video output is not a valid bounded MP4.");
  }
  const brands = [prefix.toString("ascii", contentOffset, contentOffset + 4)];
  for (let offset = contentOffset + 8; offset + 4 <= size; offset += 4) {
    brands.push(prefix.toString("ascii", offset, offset + 4));
  }
  if (!brands.some((brand) => ALLOWED_MP4_BRANDS.has(brand))) {
    throw new Error("Video output uses an unsupported MP4 brand.");
  }
}

export class Mp4StreamInspector {
  private header = Buffer.alloc(0);
  private remaining = 0;
  private openEndedMdat = false;
  private extendedType = "";
  private hasMoov = false;
  private hasMdat = false;

  push(chunk: Buffer): void {
    let offset = 0;
    while (offset < chunk.length) {
      if (this.openEndedMdat) return;
      if (this.remaining > 0) {
        const consumed = Math.min(this.remaining, chunk.length - offset);
        this.remaining -= consumed;
        offset += consumed;
        continue;
      }
      const headerSize = this.extendedType ? 8 : 8;
      const needed = headerSize - this.header.length;
      const consumed = Math.min(needed, chunk.length - offset);
      this.header = Buffer.concat([this.header, chunk.subarray(offset, offset + consumed)]);
      offset += consumed;
      if (this.header.length < headerSize) continue;
      if (this.extendedType) {
        const largeSize = this.header.readBigUInt64BE(0);
        const type = this.extendedType;
        this.extendedType = "";
        this.header = Buffer.alloc(0);
        if (largeSize < 16n || largeSize > BigInt(Number.MAX_SAFE_INTEGER)) {
          throw new Error("Video output has malformed MP4 box structure.");
        }
        if (type === "moov") this.hasMoov = true;
        if (type === "mdat") this.hasMdat = true;
        this.remaining = Number(largeSize) - 16;
        continue;
      }
      const size = this.header.readUInt32BE(0);
      const type = this.header.toString("ascii", 4, 8);
      this.header = Buffer.alloc(0);
      if (size === 1) {
        this.extendedType = type;
        continue;
      }
      if (size !== 0 && size < 8) {
        throw new Error("Video output has malformed MP4 box structure.");
      }
      if (type === "moov") this.hasMoov = true;
      if (type === "mdat") {
        this.hasMdat = true;
        if (size === 0) {
          this.openEndedMdat = true;
          return;
        }
      } else if (size === 0) {
        throw new Error("Video output has malformed MP4 box structure.");
      }
      this.remaining = size === 0 ? 0 : size - 8;
    }
  }

  finish(): void {
    if (this.header.length > 0 || this.extendedType || this.remaining > 0 || !this.hasMoov || !this.hasMdat) {
      throw new Error("Video output lacks required MP4 movie/media structure.");
    }
  }
}
