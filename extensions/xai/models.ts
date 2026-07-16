import type { Api, Model } from "@earendil-works/pi-ai";
import {
  DEFAULT_XAI_MODEL,
  XAI_CLIENT_IDENTIFIER,
  XAI_CLIENT_VERSION,
  XAI_PROVIDER_ID,
} from "./constants";
import { resolveXaiRoute, type XaiCredentialKind } from "./routing";

export const MODELS = [
  {
    id: "grok-4.5",
    name: "Grok 4.5",
    reasoning: true,
    input: ["text", "image"],
    cost: { input: 2, output: 6, cacheRead: 0.5, cacheWrite: 0 },
    contextWindow: 500_000,
    // xAI has not published a Grok 4.5-specific max output limit yet;
    // keep the existing Grok Responses ceiling until official metadata is available.
    maxTokens: 131_072,
    thinkingLevelMap: {
      off: null,
      minimal: "low",
      low: "low",
      medium: "medium",
      high: "high",
      xhigh: null,
    },
  },
  {
    id: "grok-4.3",
    name: "Grok 4.3",
    reasoning: true,
    input: ["text", "image"],
    cost: { input: 1.25, output: 2.5, cacheRead: 0.2, cacheWrite: 0 },
    contextWindow: 1_000_000,
    maxTokens: 131_072,
  },
  {
    id: "grok-build",
    name: "Grok Build",
    reasoning: true,
    input: ["text", "image"],
    cost: { input: 1, output: 2, cacheRead: 0.2, cacheWrite: 0.2 },
    contextWindow: 512_000,
    maxTokens: 30_000,
  },
  {
    id: "grok-composer-2.5-fast",
    name: "Composer 2.5 Fast",
    reasoning: false,
    input: ["text", "image"],
    cost: { input: 3, output: 15, cacheRead: 0.5, cacheWrite: 0 },
    contextWindow: 200_000,
    maxTokens: 30_000,
    thinkingLevelMap: {
      off: "none",
      minimal: null,
      low: null,
      medium: null,
      high: null,
      xhigh: null,
    },
  },
  {
    id: "grok-4.20-0309-reasoning",
    name: "Grok 4.20 Reasoning",
    reasoning: true,
    input: ["text", "image"],
    cost: { input: 1.25, output: 2.5, cacheRead: 0.2, cacheWrite: 0 },
    contextWindow: 2_000_000,
    maxTokens: 131_072,
  },
  {
    id: "grok-4.20-0309-non-reasoning",
    name: "Grok 4.20 Non-Reasoning",
    reasoning: false,
    input: ["text", "image"],
    cost: { input: 1.25, output: 2.5, cacheRead: 0.2, cacheWrite: 0 },
    contextWindow: 2_000_000,
    maxTokens: 131_072,
  },
  {
    id: "grok-4.20-multi-agent-0309",
    name: "Grok 4.20 Multi-Agent",
    reasoning: true,
    input: ["text", "image"],
    cost: { input: 1.25, output: 2.5, cacheRead: 0.2, cacheWrite: 0 },
    contextWindow: 2_000_000,
    maxTokens: 131_072,
  },
];

/** Build a pi model object for a credential-aware direct xAI request. */
export function xaiModelForRequest(modelId: string | undefined, credentialKind: XaiCredentialKind): Model<Api> {
  const id = modelId || DEFAULT_XAI_MODEL;
  const model =
    MODELS.find((candidate) => candidate.id === id) ||
    MODELS.find((candidate) => candidate.id === DEFAULT_XAI_MODEL) ||
    MODELS[0];
  return {
    ...model,
    id,
    provider: XAI_PROVIDER_ID,
    api: "xai-responses",
    baseUrl: resolveXaiRoute(credentialKind, "responses").baseUrl,
  } as any;
}

/** Normalize provider/model-prefixed xAI model ids for capability comparisons. */
export function normalizedXaiModelId(modelId: string): string {
  return (modelId || "").toLowerCase().split("/").pop() || "";
}

/** Return true for models that need Grok CLI compatibility behavior. */
export function isGrokCliCompatibilityModel(modelId: string): boolean {
  const normalized = normalizedXaiModelId(modelId);
  return normalized === "grok-build" || normalized === "grok-composer-2.5-fast";
}

export type XaiClientMode = "interactive" | "headless";

export interface XaiProxyRequestMetadata {
  conversationId: string;
  requestId: string;
  sessionId: string;
}

/** Resolve truthful Grok proxy client mode from pi's arguments and terminal state. */
export function resolveXaiClientMode(
  argv: readonly string[] = process.argv.slice(2),
  stdinIsTTY = process.stdin.isTTY === true,
  stdoutIsTTY = process.stdout.isTTY === true,
): XaiClientMode {
  let outputMode: "text" | "json" | "rpc" | undefined;
  let printRequested = false;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--mode" && index + 1 < argv.length) {
      const candidate = argv[++index];
      if (candidate === "text" || candidate === "json" || candidate === "rpc") outputMode = candidate;
    } else if (arg === "-p" || arg === "--print") {
      printRequested = true;
    }
  }

  if (outputMode === "json" || outputMode === "rpc" || printRequested) return "headless";
  return stdinIsTTY && stdoutIsTTY ? "interactive" : "headless";
}

/** Build the complete metadata contract for an OAuth request to the Grok CLI proxy. */
export function xaiProxyRequestHeaders(
  modelId: string,
  credentialKind: XaiCredentialKind,
  metadata: XaiProxyRequestMetadata,
): Record<string, string> {
  if (credentialKind !== "oauth-session") return {};

  return {
    "x-grok-client-identifier": XAI_CLIENT_IDENTIFIER,
    "x-grok-client-version": XAI_CLIENT_VERSION,
    "X-XAI-Token-Auth": "xai-grok-cli",
    "x-authenticateresponse": "authenticate-response",
    "x-grok-client-mode": resolveXaiClientMode(),
    "x-grok-conv-id": metadata.conversationId,
    "x-grok-req-id": metadata.requestId,
    "x-grok-model-override": normalizedXaiModelId(modelId),
    "x-grok-session-id": metadata.sessionId,
  };
}

/** Return true when xAI accepts an explicit Responses reasoning effort. */
export function grokSupportsReasoningEffort(modelId: string): boolean {
  const normalized = normalizedXaiModelId(modelId);
  return (
    normalized.startsWith("grok-3-mini") ||
    normalized.startsWith("grok-4.20-multi-agent") ||
    normalized.startsWith("grok-4.3") ||
    normalized.startsWith("grok-4.5")
  );
}
