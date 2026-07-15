import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { Api, Model } from "@earendil-works/pi-ai";
import { XAI_PROVIDER_ID } from "../constants";
import { isGrokCliProxyModel } from "../models";

/** Paid xAI tools that invoke xAI's server-side web or X search. */
export const XAI_SEARCH_TOOL_NAMES = [
  "xai_web_search",
  "xai_x_search",
  "xai_multi_agent",
  "xai_deep_research",
  "WebSearch",
] as const;

export type XaiSearchToolName = (typeof XAI_SEARCH_TOOL_NAMES)[number];

export interface XaiSearchToolUpdateResult {
  ok: boolean;
  active: boolean;
  error?: string;
}

const explicitlyEnabledXaiSearchTools = new WeakMap<object, Set<XaiSearchToolName>>();
const xaiSearchToolNameSet = new Set<string>(XAI_SEARCH_TOOL_NAMES);

function activeToolsWithExplicitSearchSelection(
  activeTools: readonly string[],
  enabledSearchTools: ReadonlySet<XaiSearchToolName>,
): string[] {
  return [
    ...activeTools.filter((name) => !xaiSearchToolNameSet.has(name)),
    ...XAI_SEARCH_TOOL_NAMES.filter((name) => enabledSearchTools.has(name)),
  ];
}

/** Return the active xAI model, or undefined when the session is using another provider. */
export function activeXaiModel(ctx: Pick<ExtensionContext, "model"> | undefined): Model<Api> | undefined {
  const model = ctx?.model;
  if (model?.provider !== XAI_PROVIDER_ID || typeof model.id !== "string" || !model.id.trim()) return undefined;
  return model as Model<Api>;
}

/** Return whether a paid search tool is deliberately active in pi's current tool set. */
export function isXaiSearchToolActive(api: any, toolName: XaiSearchToolName): boolean {
  if (typeof api?.getActiveTools !== "function") return false;
  try {
    if (!explicitlyEnabledXaiSearchTools.get(api as object)?.has(toolName)) return false;
    const activeTools = api.getActiveTools();
    return Array.isArray(activeTools) && activeTools.includes(toolName);
  } catch {
    return false;
  }
}

/** Deliberately enable or disable one paid xAI search tool for the current model scope. */
export function setXaiSearchToolActive(
  api: any,
  model: Model<Api> | undefined,
  toolName: XaiSearchToolName,
  active: boolean,
): XaiSearchToolUpdateResult {
  const xaiModel = activeXaiModel(model ? { model } : undefined);
  if (active && !xaiModel) {
    return {
      ok: false,
      active: false,
      error: "Select an xAI/Grok model before enabling a paid xAI search tool.",
    };
  }
  if (active && toolName === "WebSearch" && !isGrokCliProxyModel(xaiModel!.id)) {
    return {
      ok: false,
      active: false,
      error: "WebSearch is available only with xAI Grok Build or Composer models.",
    };
  }
  if (typeof api?.getActiveTools !== "function" || typeof api?.setActiveTools !== "function") {
    return {
      ok: false,
      active: false,
      error: "pi's active-tool registry is unavailable; no tools were changed.",
    };
  }

  const scope = api as object;
  const previousSelection = new Set(explicitlyEnabledXaiSearchTools.get(scope) ?? []);
  const nextSelection = xaiModel ? new Set(previousSelection) : new Set<XaiSearchToolName>();
  if (xaiModel && !isGrokCliProxyModel(xaiModel.id)) nextSelection.delete("WebSearch");
  if (active) nextSelection.add(toolName);
  else nextSelection.delete(toolName);

  let activeTools: string[];
  try {
    const current = api.getActiveTools();
    if (!Array.isArray(current)) throw new Error("invalid active-tool registry response");
    activeTools = current as string[];
  } catch {
    return {
      ok: false,
      active: previousSelection.has(toolName),
      error: "pi's active-tool registry could not be read; no tools were changed.",
    };
  }

  const nextTools = activeToolsWithExplicitSearchSelection(activeTools, nextSelection);
  try {
    const unchanged = nextTools.length === activeTools.length
      && nextTools.every((name, index) => name === activeTools[index]);
    if (!unchanged) api.setActiveTools(nextTools);
    if (xaiModel) explicitlyEnabledXaiSearchTools.set(scope, nextSelection);
    else explicitlyEnabledXaiSearchTools.delete(scope);
    return { ok: true, active };
  } catch {
    return {
      ok: false,
      active: previousSelection.has(toolName),
      error: "pi's active-tool registry could not be updated; no tools were changed.",
    };
  }
}

/**
 * Keep paid xAI search tools opt-in and remove them immediately outside xAI models.
 *
 * A session start resets them even for xAI models so installing or reloading the
 * extension cannot silently expose a credit-gated tool. Users can deliberately
 * enable an individual tool through this package's `/xai-tools` command while
 * an xAI model is active.
 */
export function syncXaiSearchToolsForModel(api: any, model?: Model<Api>, options?: { reset?: boolean }) {
  if (typeof api?.getActiveTools !== "function" || typeof api?.setActiveTools !== "function") return;
  const scope = api as object;
  const xaiModel = activeXaiModel(model ? { model } : undefined);
  let enabledSearchTools: Set<XaiSearchToolName>;
  if (options?.reset || !xaiModel) {
    explicitlyEnabledXaiSearchTools.delete(scope);
    enabledSearchTools = new Set();
  } else {
    enabledSearchTools = new Set(explicitlyEnabledXaiSearchTools.get(scope) ?? []);
    if (!isGrokCliProxyModel(xaiModel.id)) enabledSearchTools.delete("WebSearch");
    explicitlyEnabledXaiSearchTools.set(scope, enabledSearchTools);
  }

  let activeTools: string[];
  try {
    const current = api.getActiveTools();
    activeTools = Array.isArray(current) ? (current as string[]) : [];
  } catch {
    return;
  }

  const nextTools = activeToolsWithExplicitSearchSelection(activeTools, enabledSearchTools);
  const unchanged = nextTools.length === activeTools.length
    && nextTools.every((name, index) => name === activeTools[index]);
  if (unchanged) return;

  try {
    api.setActiveTools(nextTools);
  } catch {
    // The registry can be transiently unavailable during startup. The
    // before_agent_start synchronization retries before any model request.
  }
}
