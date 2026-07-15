import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { getGrokAuthCredentials } from "./xai/auth";
import { XAI_API_BASE_URL, XAI_PROVIDER_ID } from "./xai/constants";
import { MODELS } from "./xai/models";
import { createXaiOAuth } from "./xai/oauth";
import { streamSimpleXaiResponses } from "./xai/responses";
import { registerXaiTools, syncXaiToolsForModel } from "./xai/tools";

export default function (pi: ExtensionAPI) {
  pi.registerProvider(XAI_PROVIDER_ID, {
    name: "xAI (OAuth)",
    baseUrl: XAI_API_BASE_URL,
    api: "xai-responses",
    models: MODELS as any,
    authHeader: true,
    streamSimple: streamSimpleXaiResponses as any,
    oauth: createXaiOAuth({ getExistingCredentials: getGrokAuthCredentials }) as any,
  });

  registerXaiTools(pi);

  if (typeof (pi as any).on === "function") {
    // Active-tool accessors belong to the ExtensionAPI (`pi`), while models
    // are supplied by the event/context payload.
    (pi as any).on("session_start", (_event: any, ctx: any) =>
      syncXaiToolsForModel(pi, ctx?.model, { resetSearchTools: true }),
    );
    (pi as any).on("model_select", (event: any, ctx: any) =>
      syncXaiToolsForModel(pi, event?.model ?? ctx?.model),
    );
    (pi as any).on("before_agent_start", (_event: any, ctx: any) => syncXaiToolsForModel(pi, ctx?.model));
  }
}
