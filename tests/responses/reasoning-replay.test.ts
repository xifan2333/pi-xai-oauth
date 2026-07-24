import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { convertResponsesMessages } from "@earendil-works/pi-ai/api/openai-responses-shared";
import { describe, expect, it } from "vitest";
import { TEST_MODEL } from "../fixtures/models";

const encryptedContent = "opaque-π+/=reasoning-state";
const reasoningItem = {
  id: "rs_1",
  type: "reasoning",
  summary: [],
  encrypted_content: encryptedContent,
  status: "completed",
  future_field: { preserved: true },
};

function assistantMessage(overrides: Record<string, unknown> = {}) {
  return {
    role: "assistant",
    content: [
      { type: "thinking", thinking: "", thinkingSignature: JSON.stringify(reasoningItem) },
      { type: "text", text: "working", textSignature: "msg_1" },
      {
        type: "toolCall",
        id: "call_1|fc_1",
        name: "read_file",
        arguments: { path: "README.md" },
      },
    ],
    api: TEST_MODEL.api,
    provider: TEST_MODEL.provider,
    model: TEST_MODEL.id,
    usage: {
      input: 1,
      output: 1,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 2,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason: "toolUse",
    timestamp: 2,
    ...overrides,
  } as any;
}

function convert(messages: any[], model = TEST_MODEL as any) {
  return convertResponsesMessages(model, { messages } as any, new Set([model.provider]));
}

describe("encrypted reasoning replay", () => {
  it("replays the complete item inline with messages, tools, outputs, and later users", () => {
    const messages = [
      { role: "user", content: "first", timestamp: 1 },
      assistantMessage(),
      {
        role: "toolResult",
        toolCallId: "call_1|fc_1",
        toolName: "read_file",
        content: [{ type: "text", text: "result" }],
        isError: false,
        timestamp: 3,
      },
      { role: "user", content: "next", timestamp: 4 },
    ];
    const input = convert(messages) as any[];

    expect(input.map((item) => item.type ?? item.role)).toEqual([
      "user",
      "reasoning",
      "message",
      "function_call",
      "function_call_output",
      "user",
    ]);
    expect(input[1]).toEqual(reasoningItem);
    expect(input[1].encrypted_content).toBe(encryptedContent);
  });

  it("preserves serialized prefixes across active conversation turns", () => {
    const first = [{ role: "user", content: "first", timestamp: 1 }, assistantMessage()];
    const inputN = convert(first) as any[];
    const inputN1 = convert([...first, { role: "user", content: "next", timestamp: 3 }]) as any[];
    const inputN2 = convert([
      ...first,
      { role: "user", content: "next", timestamp: 3 },
      assistantMessage({ content: [{ type: "text", text: "done", textSignature: "msg_2" }], timestamp: 4 }),
      { role: "user", content: "again", timestamp: 5 },
    ]) as any[];

    expect(JSON.stringify(inputN1.slice(0, inputN.length))).toBe(JSON.stringify(inputN));
    expect(JSON.stringify(inputN2.slice(0, inputN1.length))).toBe(JSON.stringify(inputN1));
  });

  it("persists and reloads the opaque signature through ordinary Pi session JSONL", () => {
    const root = mkdtempSync(join(tmpdir(), "pi-xai-reasoning-"));
    try {
      const manager = SessionManager.create(root, root);
      manager.appendMessage({ role: "user", content: "first", timestamp: 1 } as any);
      manager.appendMessage(assistantMessage());
      const sessionFile = manager.getSessionFile()!;
      const reopened = SessionManager.open(sessionFile, root, root);
      const messages = reopened.buildSessionContext().messages as any[];
      const signature = messages[1].content[0].thinkingSignature;
      const replay = convert(messages) as any[];

      expect(signature).toBe(JSON.stringify(reasoningItem));
      expect(replay[1]).toEqual(reasoningItem);
      expect(readFileSync(sessionFile, "utf8")).toContain(encryptedContent);
      expect(messages[1].content[0].thinking).toBe("");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("drops replay for a different exact provider, API, or model and failed turns", () => {
    const source = assistantMessage();
    const differentModel = { ...TEST_MODEL, id: `${TEST_MODEL.id}-other` } as any;
    const differentProvider = { ...TEST_MODEL, provider: "other-provider" } as any;
    const differentApi = { ...TEST_MODEL, api: "other-api" } as any;

    expect(convert([source], TEST_MODEL as any).some((item: any) => item.type === "reasoning")).toBe(true);
    expect(convert([source], differentModel).some((item: any) => item.type === "reasoning")).toBe(false);
    expect(convert([source], differentProvider).some((item: any) => item.type === "reasoning")).toBe(false);
    expect(convert([source], differentApi).some((item: any) => item.type === "reasoning")).toBe(false);
    expect(convert([assistantMessage({ stopReason: "error" })]).some((item: any) => item.type === "reasoning")).toBe(false);
    expect(convert([assistantMessage({ stopReason: "aborted" })]).some((item: any) => item.type === "reasoning")).toBe(false);
  });
});
