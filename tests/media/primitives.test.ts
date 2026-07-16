import { describe, expect, it } from "vitest";
import { MEDIA_MAX_DATA_URL_CHARS, MEDIA_MAX_SOURCE_PIXELS } from "../../extensions/xai/media/constants";
import { decodeStrictBase64, parseBoundedImageDataUrl } from "../../extensions/xai/media/data-url";
import { inspectSupportedImageBytes } from "../../extensions/xai/media/image-info";
import { jpegHeaderBytes, pngHeaderBytes, tinyPngBytes } from "../fixtures/images";

describe("bounded media byte primitives", () => {
  it("inspects PNG and JPEG dimensions from bytes", () => {
    expect(inspectSupportedImageBytes(pngHeaderBytes(640, 480), { maxPixels: 1_000_000 })).toEqual({
      mimeType: "image/png",
      width: 640,
      height: 480,
    });
    expect(inspectSupportedImageBytes(jpegHeaderBytes(320, 240), { maxPixels: 1_000_000 })).toEqual({
      mimeType: "image/jpeg",
      width: 320,
      height: 240,
    });
  });

  it("rejects unsupported, malformed, zero-sized, pixel-bomb, and side-bomb headers", () => {
    expect(() => inspectSupportedImageBytes(Buffer.from("GIF89a"), { maxPixels: 100 })).toThrow(/PNG and JPEG/);
    expect(() => inspectSupportedImageBytes(pngHeaderBytes(0, 1), { maxPixels: 100 })).toThrow(/dimensions/);
    expect(() => inspectSupportedImageBytes(pngHeaderBytes(4000, 4000), { maxPixels: MEDIA_MAX_SOURCE_PIXELS })).toThrow(/pixel/);
    expect(() => inspectSupportedImageBytes(pngHeaderBytes(100, 2), { maxPixels: 1_000, maxSidePx: 99 })).toThrow(/dimension/);
    expect(() => inspectSupportedImageBytes(Buffer.from([0xff, 0xd8, 0xff, 0xda]), { maxPixels: 100 })).toThrow(/frame/);
  });

  it("accepts only canonical standard base64", () => {
    expect(decodeStrictBase64("YWJj", 8, 3).toString()).toBe("abc");
    for (const value of ["YWJj\n", "YWJj_", "YQ=", "YQ===", ""]) {
      expect(() => decodeStrictBase64(value, 20, 20)).toThrow();
    }
    expect(() => decodeStrictBase64("YWJj", 3, 3)).toThrow(/encoded/);
    expect(() => decodeStrictBase64("YWJj", 8, 2)).toThrow(/decoded/);
  });

  it("parses strict byte-matched PNG data URLs", () => {
    const bytes = tinyPngBytes();
    const result = parseBoundedImageDataUrl(`data:image/png;base64,${bytes.toString("base64")}`);
    expect(result).toMatchObject({ mimeType: "image/png", width: 1, height: 1, source: "data-url" });
    expect(result.bytes).toEqual(bytes);
  });

  it("rejects MIME mismatch, parameters, whitespace, aliases, malformed data, and encoded overflow", () => {
    const base64 = tinyPngBytes().toString("base64");
    for (const value of [
      `data:image/jpeg;base64,${base64}`,
      `data:image/png;charset=utf-8;base64,${base64}`,
      `data:image/png;base64,${base64}\n`,
      `data:image/jpg;base64,${base64}`,
      "data:image/png;base64,%%%%",
      `data:image/png;base64,${"A".repeat(MEDIA_MAX_DATA_URL_CHARS + 1)}`,
    ]) {
      expect(() => parseBoundedImageDataUrl(value)).toThrow();
    }
  });
});
