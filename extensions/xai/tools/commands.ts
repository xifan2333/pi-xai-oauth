import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import type { Api, Model } from "@earendil-works/pi-ai";
import { isGrokCliProxyModel } from "../models";
import {
  activeXaiModel,
  isXaiSearchToolActive,
  setXaiSearchToolActive,
  XAI_SEARCH_TOOL_NAMES,
  type XaiSearchToolName,
} from "./model-scope";

interface PaidToolOption {
  name: XaiSearchToolName;
  summary: string;
}

const PAID_TOOL_OPTIONS: readonly PaidToolOption[] = [
  { name: "xai_web_search", summary: "native xAI web search" },
  { name: "xai_x_search", summary: "native xAI X search" },
  { name: "xai_multi_agent", summary: "multi-agent web/X research" },
  { name: "xai_deep_research", summary: "deep web/X research" },
  { name: "WebSearch", summary: "Grok Build/Composer native web search" },
];

const XAI_TOOLS_USAGE =
  "Usage: /xai-tools [status | enable <tool> | disable <tool>]";

function commandToolName(value: string | undefined): XaiSearchToolName | undefined {
  if (!value) return undefined;
  const normalized = value.toLowerCase();
  return XAI_SEARCH_TOOL_NAMES.find((name) => name.toLowerCase() === normalized);
}

function eligibleToolOptions(model: Model<Api>): readonly PaidToolOption[] {
  return PAID_TOOL_OPTIONS.filter(
    ({ name }) => name !== "WebSearch" || isGrokCliProxyModel(model.id),
  );
}

function activeToolStatus(pi: ExtensionAPI, model: Model<Api> | undefined): string {
  return PAID_TOOL_OPTIONS.map(({ name }) => {
    const unavailable = name === "WebSearch" && (!model || !isGrokCliProxyModel(model.id));
    if (unavailable) return `${name}=unavailable`;
    return `${name}=${isXaiSearchToolActive(pi, name) ? "enabled" : "disabled"}`;
  }).join(", ");
}

function notifyUpdate(
  ctx: ExtensionCommandContext,
  toolName: XaiSearchToolName,
  active: boolean,
  error?: string,
) {
  if (error) {
    ctx.ui.notify(error, "error");
    return;
  }
  ctx.ui.notify(
    active
      ? `Enabled ${toolName} for this xAI session. Calls may use xAI credits.`
      : `Disabled ${toolName}.`,
    active ? "warning" : "info",
  );
}

async function showXaiToolPicker(
  pi: ExtensionAPI,
  ctx: ExtensionCommandContext,
  model: Model<Api>,
) {
  if (!ctx.hasUI) {
    ctx.ui.notify(`${XAI_TOOLS_USAGE} Interactive selection requires TUI or RPC mode.`, "error");
    return;
  }

  while (true) {
    const labels = new Map<string, XaiSearchToolName>();
    for (const option of eligibleToolOptions(model)) {
      const active = isXaiSearchToolActive(pi, option.name);
      labels.set(
        `${active ? "[x]" : "[ ]"} ${option.name} — ${option.summary}`,
        option.name,
      );
    }
    const done = "Done";
    const selected = await ctx.ui.select(
      "xAI paid tools — explicit opt-in; enabled calls may use xAI credits",
      [...labels.keys(), done],
    );
    if (!selected || selected === done) return;

    const toolName = labels.get(selected);
    if (!toolName) continue;
    const nextActive = !isXaiSearchToolActive(pi, toolName);
    const result = setXaiSearchToolActive(pi, model, toolName, nextActive);
    notifyUpdate(ctx, toolName, result.active, result.error);
    if (!result.ok) return;
  }
}

/** Register the package-owned command for explicitly managing paid xAI tools. */
export function registerXaiToolsCommand(pi: ExtensionAPI) {
  pi.registerCommand("xai-tools", {
    description: "Enable or disable paid xAI search tools for this session",
    handler: async (args, ctx) => {
      const [action, rawToolName, ...extra] = args.trim().split(/\s+/).filter(Boolean);
      const model = activeXaiModel(ctx);

      if (!action) {
        if (!model) {
          ctx.ui.notify("Select an xAI/Grok model before opening /xai-tools.", "error");
          return;
        }
        await showXaiToolPicker(pi, ctx, model);
        return;
      }

      if (action.toLowerCase() === "status" && !rawToolName) {
        ctx.ui.notify(
          `xAI paid tools${model ? ` for ${model.id}` : " (no active xAI model)"}: ${activeToolStatus(pi, model)}`,
          "info",
        );
        return;
      }

      const normalizedAction = action.toLowerCase();
      const toolName = commandToolName(rawToolName);
      if (
        (normalizedAction !== "enable" && normalizedAction !== "disable")
        || !toolName
        || extra.length > 0
      ) {
        ctx.ui.notify(XAI_TOOLS_USAGE, "error");
        return;
      }

      const result = setXaiSearchToolActive(
        pi,
        model,
        toolName,
        normalizedAction === "enable",
      );
      notifyUpdate(ctx, toolName, result.active, result.error);
    },
  });
}
