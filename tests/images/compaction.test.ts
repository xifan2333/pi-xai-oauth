import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { resizeImage } from "@earendil-works/pi-coding-agent";
import { compactXaiInlineImages } from "../../extensions/xai/images";

function urls(value: any) {
  const result: string[] = [];
  const walk = (item: any) => {
    if (Array.isArray(item)) return item.forEach(walk);
    if (!item || typeof item !== "object") return;
    if (
      item.type === "input_image" &&
      String(item.image_url).startsWith("data:image/")
    )
      result.push(item.image_url);
    Object.values(item).forEach(walk);
  };
  walk(value);
  return result;
}

describe("inline image compaction", () => {
  it("keeps under-budget images byte-identical", async () => {
    const base64 = (await readFile("preview.jpeg")).toString("base64");
    const url = `data:image/jpeg;base64,${base64}`;
    const payload = {
      input: [
        {
          content: [
            { type: "input_image", image_url: url },
            { type: "input_image", image_url: url },
          ],
        },
      ],
    };
    expect(
      urls(await compactXaiInlineImages(payload, base64.length * 2 + 1)),
    ).toEqual([url, url]);
  });
  it("obeys aggregate byte and dimension bounds", async () => {
    const base64 = (await readFile("preview.jpeg")).toString("base64");
    const url = `data:image/jpeg;base64,${base64}`;
    const budget = Math.floor(base64.length * 1.5);
    const result = await compactXaiInlineImages(
      {
        input: [
          {
            content: [
              { type: "input_image", image_url: url },
              { type: "input_image", image_url: url },
            ],
          },
        ],
      },
      budget,
    );
    const compacted = urls(result);
    expect(compacted).toHaveLength(2);
    expect(
      compacted.reduce(
        (sum, value) => sum + Buffer.byteLength(value.split(",")[1]),
        0,
      ),
    ).toBeLessThanOrEqual(budget);
    for (const value of compacted) {
      expect(value).toMatch(/^data:image\/(?:png|jpeg);base64,/);
      const [metadata, data] = value.split(",", 2);
      const inspected = await resizeImage(
        Buffer.from(data, "base64"),
        metadata.slice(5).split(";")[0],
        {
          maxWidth: 2000,
          maxHeight: 2000,
          maxBytes: data.length + 1,
          jpegQuality: 95,
        },
      );
      expect(inspected?.width).toBeLessThanOrEqual(2000);
      expect(inspected?.height).toBeLessThanOrEqual(2000);
    }
  });
  it("fails locally for undecodable oversized images and invalid budgets", async () => {
    await expect(
      compactXaiInlineImages(
        {
          input: [
            {
              type: "input_image",
              image_url: "data:image/png;base64,bm90LWFuLWltYWdl",
            },
          ],
        },
        2,
      ),
    ).rejects.toThrow(/safe transport budget/);
    await expect(compactXaiInlineImages({}, 0)).rejects.toThrow(
      /positive number/,
    );
  });
});
