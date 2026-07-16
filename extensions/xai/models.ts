import type { Api, Model } from "@earendil-works/pi-ai";
import {
  DEFAULT_XAI_MODEL,
  XAI_CLIENT_IDENTIFIER,
  XAI_CLIENT_VERSION,
  XAI_PROVIDER_ID,
} from "./constants";
import { resolveXaiRoute, type XaiCredentialKind } from "./routing";

export type XaiCatalogModel = {
  id: string;
  name: string;
  apiBackend: "responses";
  reasoning: boolean;
  input: ("text" | "image")[];
  cost: { input: number; output: number; cacheRead: number; cacheWrite: number };
  contextWindow: number;
  maxTokens: number;
  thinkingLevelMap?: Model<Api>["thinkingLevelMap"];
};

/**
 * Curated metadata for known xAI models.
 *
 * This table enriches models that the authenticated catalog actually returns;
 * it is not the provider advertisement and must never be unioned into a
 * successful entitlement response.
 */
export const KNOWN_XAI_MODEL_METADATA: readonly XaiCatalogModel[] = [
  {
    id: "grok-4.5",
    name: "Grok 4.5",
    apiBackend: "responses",
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
    apiBackend: "responses",
    reasoning: true,
    input: ["text", "image"],
    cost: { input: 1.25, output: 2.5, cacheRead: 0.2, cacheWrite: 0 },
    contextWindow: 1_000_000,
    maxTokens: 131_072,
  },
  {
    id: "grok-build",
    name: "Grok Build",
    apiBackend: "responses",
    reasoning: true,
    input: ["text", "image"],
    cost: { input: 1, output: 2, cacheRead: 0.2, cacheWrite: 0.2 },
    contextWindow: 512_000,
    maxTokens: 30_000,
  },
  {
    id: "grok-composer-2.5-fast",
    name: "Composer 2.5 Fast",
    apiBackend: "responses",
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
    apiBackend: "responses",
    reasoning: true,
    input: ["text", "image"],
    cost: { input: 1.25, output: 2.5, cacheRead: 0.2, cacheWrite: 0 },
    contextWindow: 2_000_000,
    maxTokens: 131_072,
  },
  {
    id: "grok-4.20-0309-non-reasoning",
    name: "Grok 4.20 Non-Reasoning",
    apiBackend: "responses",
    reasoning: false,
    input: ["text", "image"],
    cost: { input: 1.25, output: 2.5, cacheRead: 0.2, cacheWrite: 0 },
    contextWindow: 2_000_000,
    maxTokens: 131_072,
  },
  {
    id: "grok-4.20-multi-agent-0309",
    name: "Grok 4.20 Multi-Agent",
    apiBackend: "responses",
    reasoning: true,
    input: ["text", "image"],
    cost: { input: 1.25, output: 2.5, cacheRead: 0.2, cacheWrite: 0 },
    contextWindow: 2_000_000,
    maxTokens: 131_072,
  },
];

const KNOWN_MODEL_MAP = new Map(KNOWN_XAI_MODEL_METADATA.map((model) => [model.id, model]));

/** Minimal catalog used only when authenticated discovery cannot be used safely. */
export const CURATED_FALLBACK_MODELS: readonly XaiCatalogModel[] = [
  { ...KNOWN_MODEL_MAP.get(DEFAULT_XAI_MODEL)! },
];

/** Backward-compatible alias for the curated offline fallback. */
export const MODELS = CURATED_FALLBACK_MODELS;

let runtimeModels: readonly XaiCatalogModel[] = CURATED_FALLBACK_MODELS;

/** Replace request-helper metadata with the current entitlement snapshot. */
export function setXaiRuntimeModels(models: readonly XaiCatalogModel[]): void {
  runtimeModels = models.map((model) => ({ ...model }));
}

/** Return the current entitlement snapshot used by direct request helpers. */
export function getXaiRuntimeModels(): readonly XaiCatalogModel[] {
  return runtimeModels;
}

/** Return true only when the active OAuth catalog currently advertises a model. */
export function isXaiRuntimeModelEntitled(modelId: string): boolean {
  const normalized = normalizedXaiModelId(modelId);
  return runtimeModels.some((model) => model.id.toLowerCase() === normalized);
}

/** Choose the default model from the active OAuth catalog, if one exists. */
export function defaultXaiRuntimeModelId(): string | undefined {
  return runtimeModels.find((model) => model.id === DEFAULT_XAI_MODEL)?.id ?? runtimeModels[0]?.id;
}

/** Return curated metadata for a known model without advertising it. */
export function knownXaiModelMetadata(modelId: string): XaiCatalogModel | undefined {
  return KNOWN_MODEL_MAP.get(normalizedXaiModelId(modelId));
}

/** Build a pi model object for a credential-aware direct xAI request. */
export function xaiModelForRequest(modelId: string | undefined, credentialKind: XaiCredentialKind): Model<Api> {
  const id = modelId || DEFAULT_XAI_MODEL;
  const model =
    runtimeModels.find((candidate) => candidate.id === id) ||
    knownXaiModelMetadata(id) ||
    runtimeModels.find((candidate) => candidate.id === DEFAULT_XAI_MODEL) ||
    CURATED_FALLBACK_MODELS[0];
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
  const runtime = runtimeModels.find((model) => model.id.toLowerCase() === normalized);
  if (runtime?.thinkingLevelMap) {
    return ["minimal", "low", "medium", "high", "xhigh", "max"].some(
      (level) => typeof (runtime.thinkingLevelMap as Record<string, unknown>)[level] === "string",
    );
  }
  return (
    normalized.startsWith("grok-3-mini") ||
    normalized.startsWith("grok-4.20-multi-agent") ||
    normalized.startsWith("grok-4.3") ||
    normalized.startsWith("grok-4.5")
  );
}
