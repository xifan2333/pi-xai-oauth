import type { Api, Model } from "@earendil-works/pi-ai";
import { DEFAULT_XAI_MODEL, XAI_PROVIDER_ID } from "./constants";
import { resolveXaiRoute, type XaiCredentialKind } from "./routing";
export {
  resolveXaiClientMode,
  xaiProxyRequestHeaders,
  type XaiClientMode,
  type XaiProxyRequestMetadata,
} from "./wire";

/** Bounded evidence used to derive one normalized model input capability. */
export enum XaiModelInputProvenance {
  AuthenticatedAcceptsImages = "authenticated-accepts-images",
  AuthenticatedInputModalities = "authenticated-input-modalities",
  Known = "known-model-metadata",
  Default = "conservative-default",
}

export type XaiCatalogModel = {
  id: string;
  name: string;
  apiBackend: "responses";
  reasoning: boolean;
  input: ("text" | "image")[];
  inputProvenance: XaiModelInputProvenance;
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
    inputProvenance: XaiModelInputProvenance.Known,
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
    inputProvenance: XaiModelInputProvenance.Known,
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
    inputProvenance: XaiModelInputProvenance.Known,
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
    inputProvenance: XaiModelInputProvenance.Known,
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
    inputProvenance: XaiModelInputProvenance.Known,
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
    inputProvenance: XaiModelInputProvenance.Known,
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
    inputProvenance: XaiModelInputProvenance.Known,
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
  runtimeModels = models.map((model) => ({
    ...model,
    input: [...model.input],
    cost: { ...model.cost },
    ...(model.thinkingLevelMap ? { thinkingLevelMap: { ...model.thinkingLevelMap } } : {}),
  }));
}

/** Return the current entitlement snapshot used by direct request helpers. */
export function getXaiRuntimeModels(): readonly XaiCatalogModel[] {
  return runtimeModels;
}

/** Return true only when the active OAuth catalog currently advertises a model. */
export function isXaiRuntimeModelEntitled(modelId: string): boolean {
  return getXaiRuntimeModel(modelId) !== undefined;
}

/** Return one model from the current entitlement snapshot without falling back. */
export function getXaiRuntimeModel(modelId: string): XaiCatalogModel | undefined {
  const normalized = normalizedXaiModelId(modelId);
  return runtimeModels.find((model) => model.id.toLowerCase() === normalized);
}

/** Return whether a provenance value came from bounded authenticated catalog evidence. */
export function isAuthenticatedXaiInputProvenance(
  provenance: XaiModelInputProvenance,
): boolean {
  return provenance === XaiModelInputProvenance.AuthenticatedAcceptsImages ||
    provenance === XaiModelInputProvenance.AuthenticatedInputModalities;
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
