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

const initializedXaiSearchToolScopes = new WeakSet<object>();

/** Return the active xAI model, or undefined when the session is using another provider. */
export function activeXaiModel(ctx: Pick<ExtensionContext, "model"> | undefined): Model<Api> | undefined {
  const model = ctx?.model;
  if (model?.provider !== XAI_PROVIDER_ID || typeof model.id !== "string" || !model.id.trim()) return undefined;
  return model as Model<Api>;
}

/** Return whether a paid search tool is deliberately active in pi's current tool set. */
export function isXaiSearchToolActive(api: any, toolName: (typeof XAI_SEARCH_TOOL_NAMES)[number]): boolean {
  if (typeof api?.getActiveTools !== "function") return false;
  try {
    if (!initializedXaiSearchToolScopes.has(api as object)) return false;
    const activeTools = api.getActiveTools();
    return Array.isArray(activeTools) && activeTools.includes(toolName);
  } catch {
    return false;
  }
}

/**
 * Keep paid xAI search tools opt-in and remove them immediately outside xAI models.
 *
 * A session start resets them even for xAI models so installing or reloading the
 * extension cannot silently expose a credit-gated tool. Users can deliberately
 * enable an individual tool through pi's tool picker while an xAI model is active.
 */
export function syncXaiSearchToolsForModel(api: any, model?: Model<Api>, options?: { reset?: boolean }) {
  if (typeof api?.getActiveTools !== "function" || typeof api?.setActiveTools !== "function") return;
  const scope = api as object;
  if (options?.reset || model?.provider !== XAI_PROVIDER_ID) initializedXaiSearchToolScopes.delete(scope);
  const preservesIntentionalSelection = initializedXaiSearchToolScopes.has(scope) && model?.provider === XAI_PROVIDER_ID;
  const toolNamesToRemove: readonly string[] = preservesIntentionalSelection
    ? isGrokCliProxyModel(model.id)
      ? []
      : ["WebSearch"]
    : XAI_SEARCH_TOOL_NAMES;
  if (toolNamesToRemove.length === 0) return;

  let activeTools: string[];
  try {
    const current = api.getActiveTools();
    activeTools = Array.isArray(current) ? (current as string[]) : [];
  } catch {
    return;
  }

  const nextTools = activeTools.filter(
    (toolName) => !toolNamesToRemove.includes(toolName),
  );
  if (nextTools.length === activeTools.length) {
    initializedXaiSearchToolScopes.add(scope);
    return;
  }

  try {
    api.setActiveTools(nextTools);
    initializedXaiSearchToolScopes.add(scope);
  } catch {
    initializedXaiSearchToolScopes.delete(scope);
    // The registry can be transiently unavailable during startup. The
    // before_agent_start synchronization retries before any model request.
  }
}
