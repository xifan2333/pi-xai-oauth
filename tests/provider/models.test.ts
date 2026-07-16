import { afterEach, describe, expect, it } from "vitest";
import {
  CURATED_FALLBACK_MODELS,
  getXaiRuntimeModels,
  grokSupportsReasoningEffort,
  isGrokCliCompatibilityModel,
  normalizedXaiModelId,
  resolveXaiClientMode,
  setXaiRuntimeModels,
  xaiProxyRequestHeaders,
} from "../../extensions/xai/models";

afterEach(() => setXaiRuntimeModels(CURATED_FALLBACK_MODELS));
describe("model compatibility metadata", () => {
  it("normalizes IDs and detects Grok CLI compatibility models", () => {
    expect(normalizedXaiModelId("xai-auth/GROK-BUILD")).toBe("grok-build");
    expect(isGrokCliCompatibilityModel("grok-build")).toBe(true);
    expect(isGrokCliCompatibilityModel("grok-composer-2.5-fast")).toBe(true);
    expect(isGrokCliCompatibilityModel("grok-4.5")).toBe(false);
  });
  it("looks up runtime reasoning case-insensitively", () => {
    setXaiRuntimeModels([
      {
        ...CURATED_FALLBACK_MODELS[0],
        id: "Mixed-Case",
        thinkingLevelMap: { low: "low" },
      },
    ]);
    expect(grokSupportsReasoningEffort("mixed-case")).toBe(true);
    expect(getXaiRuntimeModels()[0].id).toBe("Mixed-Case");
  });
  it.each([
    ["TTY default", [], true, true, "interactive"],
    ["model option", ["--model", "grok-4.5"], true, true, "interactive"],
    ["text mode", ["--mode", "text"], true, true, "interactive"],
    ["short print", ["-p", "hello"], true, true, "headless"],
    ["long print", ["--print", "hello"], true, true, "headless"],
    ["JSON mode", ["--mode", "json"], true, true, "headless"],
    ["RPC mode", ["--mode", "rpc"], true, true, "headless"],
    ["non-TTY stdin", [], false, true, "headless"],
    ["non-TTY stdout", [], true, false, "headless"],
    [
      "text mode without stdin TTY",
      ["--mode", "text"],
      false,
      true,
      "headless",
    ],
    ["equals-form mode ignored", ["--mode=json"], true, true, "interactive"],
    ["missing mode value", ["--mode", "--print"], true, true, "interactive"],
  ] as const)("resolves %s", (_label, argv, stdin, stdout, expected) => {
    expect(resolveXaiClientMode(argv, stdin, stdout)).toBe(expected);
  });
  it("omits proxy metadata for API keys and includes protected OAuth metadata", () => {
    expect(
      xaiProxyRequestHeaders("grok-4.5", "api-key", {
        conversationId: "c",
        requestId: "r",
        sessionId: "s",
      }),
    ).toEqual({});
    expect(
      xaiProxyRequestHeaders("grok-4.5", "oauth-session", {
        conversationId: "c",
        requestId: "r",
        sessionId: "s",
      }),
    ).toMatchObject({
      "X-XAI-Token-Auth": "xai-grok-cli",
      "x-grok-conv-id": "c",
      "x-grok-req-id": "r",
      "x-grok-model-override": "grok-4.5",
      "x-grok-session-id": "s",
    });
  });
});
