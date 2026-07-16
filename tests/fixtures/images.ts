import { deflateSync } from "node:zlib";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function crc32(bytes: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBytes = Buffer.from(type, "ascii");
  const header = Buffer.alloc(8);
  header.writeUInt32BE(data.length, 0);
  typeBytes.copy(header, 4);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 0);
  return Buffer.concat([header, data, checksum]);
}

/** Return a fully decodable 1x1 PNG fixture. */
export function tinyPngBytes(): Buffer {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  );
}

/** Return a header-only PNG fixture for byte/dimension parser tests. */
export function pngHeaderBytes(width: number, height: number): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  return Buffer.concat([PNG_SIGNATURE, pngChunk("IHDR", header)]);
}

/** Return a header-only baseline JPEG fixture for byte/dimension parser tests. */
export function jpegHeaderBytes(width: number, height: number): Buffer {
  const frame = Buffer.alloc(17);
  frame.writeUInt16BE(17, 0);
  frame[2] = 8;
  frame.writeUInt16BE(height, 3);
  frame.writeUInt16BE(width, 5);
  frame[7] = 3;
  return Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xc0]), frame, Buffer.from([0xff, 0xd9])]);
}

/** Return a deterministic high-entropy RGB PNG that exercises real compression. */
export function noisePngBytes(width: number, height: number): Buffer {
  const rows = Buffer.alloc((width * 3 + 1) * height);
  let state = 0x12345678;
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 3 + 1);
    rows[rowStart] = 0;
    for (let x = 0; x < width * 3; x += 1) {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      rows[rowStart + 1 + x] = state >>> 24;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(rows, { level: 0 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}
