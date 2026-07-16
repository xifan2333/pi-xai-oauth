import { afterEach, describe, expect, it } from "vitest";
import { rewriteXaiResponsesPayload } from "../../extensions/xai/payload";
import {
  CURATED_FALLBACK_MODELS,
  KNOWN_XAI_MODEL_METADATA,
  setXaiRuntimeModels,
} from "../../extensions/xai/models";
import { TEST_MODEL } from "../fixtures/models";

afterEach(() => setXaiRuntimeModels(CURATED_FALLBACK_MODELS));
const tiny = `data:image/png;base64,${Buffer.from("tiny").toString("base64")}`;
const toolImage = (callId = "call") => ({
  type: "function_call_output",
  call_id: callId,
  output: [
    { type: "input_text", text: "result" },
    { type: "input_image", image_url: tiny, detail: "auto" },
  ],
});
const inlineImages = (value: any): string[] => {
  const urls: string[] = [];
  const walk = (item: any) => {
    if (Array.isArray(item)) return item.forEach(walk);
    if (!item || typeof item !== "object") return;
    if (
      item.type === "input_image" &&
      String(item.image_url).startsWith("data:image/")
    )
      urls.push(item.image_url);
    Object.values(item).forEach(walk);
  };
  walk(value);
  return urls;
};

describe("Responses payload normalization", () => {
  it.each([
    { type: "reasoning", summary: [] },
    { type: "function_call", call_id: "next", name: "read", arguments: "{}" },
    {
      type: "message",
      role: "assistant",
      content: [{ type: "output_text", text: "done" }],
    },
  ])("omits consumed tool images after $type", (assistant) => {
    const result = rewriteXaiResponsesPayload(
      {
        model: TEST_MODEL.id,
        input: [toolImage(), assistant, { role: "user", content: "next" }],
      },
      TEST_MODEL,
    );
    expect(inlineImages(result)).toHaveLength(0);
    expect(JSON.stringify(result)).toMatch(/historical tool image.*omitted/);
  });
  it("retains pending tool images until the next assistant output", () => {
    expect(
      inlineImages(
        rewriteXaiResponsesPayload(
          { model: TEST_MODEL.id, input: [toolImage()] },
          TEST_MODEL,
        ),
      ),
    ).toHaveLength(1);
    expect(
      inlineImages(
        rewriteXaiResponsesPayload(
          {
            model: TEST_MODEL.id,
            input: [
              toolImage(),
              { role: "user", content: "continue" },
              { type: "function_call_output", call_id: "b", output: "text" },
            ],
          },
          TEST_MODEL,
        ),
      ),
    ).toHaveLength(1);
  });
  it("omits historical but retains current tool images", () => {
    const result = rewriteXaiResponsesPayload(
      {
        model: TEST_MODEL.id,
        input: [
          toolImage("old"),
          {
            type: "message",
            role: "assistant",
            content: [{ type: "output_text", text: "seen" }],
          },
          toolImage("new"),
        ],
      },
      TEST_MODEL,
    );
    expect(inlineImages(result)).toHaveLength(1);
  });
  it("never prunes ordinary user images", () => {
    const result = rewriteXaiResponsesPayload(
      {
        model: TEST_MODEL.id,
        input: [
          { role: "user", content: [{ type: "input_image", image_url: tiny }] },
          { role: "assistant", content: "seen" },
        ],
      },
      TEST_MODEL,
    );
    expect(inlineImages(result)).toHaveLength(1);
  });
  it("moves leading system/developer text to instructions for standard models", () => {
    const result: any = rewriteXaiResponsesPayload(
      {
        model: "grok-4.5",
        instructions: "base",
        input: [
          { role: "system", content: "system" },
          {
            role: "developer",
            content: [{ type: "input_text", text: "developer" }],
          },
          { role: "user", content: "hello" },
        ],
      },
      TEST_MODEL,
    );
    expect(result.instructions).toBe("base\n\nsystem\n\ndeveloper");
    expect(result.input).toEqual([{ role: "user", content: "hello" }]);
  });
  it("removes all system and reasoning replay for CLI models", () => {
    setXaiRuntimeModels(KNOWN_XAI_MODEL_METADATA);
    const model = { ...TEST_MODEL, id: "grok-composer-2.5-fast" } as any;
    const result: any = rewriteXaiResponsesPayload(
      {
        model: model.id,
        input: [
          { role: "user", content: "first" },
          { role: "system", content: "late" },
          { type: "reasoning", summary: [] },
          { role: "user", content: "" },
        ],
        include: ["reasoning.encrypted_content", "other"],
      },
      model,
    );
    expect(result.instructions).toBe("late");
    expect(result.input).toEqual([{ role: "user", content: "first" }]);
    expect(result.include).toEqual(["other"]);
  });
  it("normalizes response format, reasoning effort, and prompt cache fields", () => {
    setXaiRuntimeModels(KNOWN_XAI_MODEL_METADATA);
    const result: any = rewriteXaiResponsesPayload(
      {
        model: "grok-4.5",
        input: "hello",
        response_format: { type: "json_object" },
        reasoning: { effort: "minimal" },
        prompt_cache_retention: "24h",
      },
      TEST_MODEL,
      { sessionId: "session" } as any,
    );
    expect(result).toMatchObject({
      text: { format: { type: "json_object" } },
      reasoning: { effort: "low" },
      prompt_cache_key: "session",
    });
    expect(result).not.toHaveProperty("response_format");
    expect(result).not.toHaveProperty("prompt_cache_retention");
  });
  it("normalizes generic image shapes", () => {
    const result: any = rewriteXaiResponsesPayload(
      {
        model: "grok-4.5",
        input: [
          {
            role: "user",
            content: [
              { type: "image", data: "YWJj", mimeType: "image/png" },
              {
                type: "image_url",
                image_url: {
                  url: "https://example.test/a.png",
                  detail: "high",
                },
              },
            ],
          },
        ],
      },
      TEST_MODEL,
    );
    expect(result.input[0].content).toEqual([
      {
        type: "input_image",
        image_url: "data:image/png;base64,YWJj",
        detail: "auto",
      },
      {
        type: "input_image",
        image_url: "https://example.test/a.png",
        detail: "high",
      },
    ]);
  });
});
