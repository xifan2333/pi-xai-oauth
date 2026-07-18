import { describe, expect, it, vi } from "vitest";
import {
  downloadXaiVideo,
  isPublicVideoDownloadAddress,
} from "../../extensions/xai/video-download";
import { validateMp4Prefix } from "../../extensions/xai/media/video-info";

describe("video download safety", () => {
  it("accepts public addresses and rejects special-use ranges", () => {
    expect(isPublicVideoDownloadAddress("93.184.216.34")).toBe(true);
    for (const address of [
      "127.0.0.1",
      "10.0.0.1",
      "172.16.0.1",
      "192.168.1.1",
      "169.254.1.1",
      "100.64.0.1",
      "198.18.0.1",
      "203.0.113.1",
      "::1",
      "fc00::1",
      "fe80::1",
      "ff02::1",
      "2001:db8::1",
      "2606:2800:220:1:248:1893:25c8:1946",
      "::ffff:127.0.0.1",
    ]) expect(isPublicVideoDownloadAddress(address)).toBe(false);
  });

  it("validates bounded MP4 ftyp evidence", () => {
    const valid = Buffer.from([
      0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70,
      0x69, 0x73, 0x6f, 0x6d, 0, 0, 0, 0,
      0x69, 0x73, 0x6f, 0x32, 0x6d, 0x70, 0x34, 0x32,
    ]);
    expect(() => validateMp4Prefix(valid)).not.toThrow();
    expect(() => validateMp4Prefix(Buffer.alloc(24))).toThrow(/valid bounded MP4/);
    const badBrand = Buffer.from(valid);
    badBrand.write("nope", 8, "ascii");
    badBrand.write("bad!", 16, "ascii");
    badBrand.write("bad?", 20, "ascii");
    expect(() => validateMp4Prefix(badBrand)).toThrow(/unsupported MP4 brand/);
  });

  it("rejects unsafe URLs and mixed public/private DNS before HTTPS", async () => {
    const request = vi.fn();
    const base = {
      outputRoot: process.cwd(),
      sessionRoot: process.cwd(),
      duration: 6 as const,
      resolution: "480p" as const,
    };
    await expect(downloadXaiVideo({ ...base, url: "http://example.test/video.mp4" }))
      .rejects.toThrow(/failed safely/);
    await expect(downloadXaiVideo({ ...base, url: "https://cdn.example.test/video.mp4" }, {
      lookup: vi.fn(async () => [
        { address: "93.184.216.34", family: 4 },
        { address: "127.0.0.1", family: 4 },
      ]) as any,
      request: request as any,
    })).rejects.toThrow(/failed safely/);
    expect(request).not.toHaveBeenCalled();
  });

  it("cancels a stalled DNS lookup without issuing HTTPS", async () => {
    const controller = new AbortController();
    const request = vi.fn();
    const pending = downloadXaiVideo({
      url: "https://cdn.example.test/video.mp4",
      outputRoot: process.cwd(),
      sessionRoot: process.cwd(),
      duration: 6,
      resolution: "480p",
      signal: controller.signal,
    }, {
      lookup: vi.fn(() => new Promise(() => {})) as any,
      request: request as any,
      timeoutMs: 10_000,
    });
    controller.abort();
    await expect(pending).rejects.toThrow(/cancelled/);
    expect(request).not.toHaveBeenCalled();
  });
});
