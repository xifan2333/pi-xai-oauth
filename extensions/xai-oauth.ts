import type { OAuthCredentials, OAuthLoginCallbacks } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { selectXaiModelCatalog, type XaiCatalogSelection } from "./xai/catalog";
import { getGrokAuthCredentials, getStartupXaiCatalogAuth } from "./xai/auth";
import { DEFAULT_XAI_MODEL, XAI_PROVIDER_ID } from "./xai/constants";
import { CURATED_FALLBACK_MODELS, setXaiRuntimeModels, type XaiCatalogModel } from "./xai/models";
import { createXaiOAuth } from "./xai/oauth";
import { streamSimpleXaiResponses } from "./xai/responses";
import { resolveXaiRoute } from "./xai/routing";
import { registerXaiTools, syncXaiToolsForModel } from "./xai/tools";

/** Register the xAI OAuth provider and its authenticated model catalog. */
export default async function (pi: ExtensionAPI) {
  const oauthResponsesRoute = resolveXaiRoute("oauth-session", "responses");
  let currentModels: readonly XaiCatalogModel[] = CURATED_FALLBACK_MODELS;
  let needsSessionRefresh = false;
  let deferredRetryAfter = 0;
  let refreshGeneration = 0;
  let loginCatalogGeneration = 0;
  let activeLoginRefreshes = 0;
  let refreshAbortController: AbortController | undefined;
  let oauth: ReturnType<typeof createXaiOAuth>;

  const providerModels = (models: readonly XaiCatalogModel[]) =>
    models.map(({ apiBackend: _apiBackend, inputProvenance: _inputProvenance, ...model }) => model);

  const providerConfig = () => ({
    name: "xAI (OAuth)",
    baseUrl: oauthResponsesRoute.baseUrl,
    api: "xai-responses" as const,
    models: providerModels(currentModels),
    authHeader: true,
    streamSimple: streamSimpleXaiResponses as any,
    oauth: oauth as any,
  });

  const curatedFallbackSelection = (): XaiCatalogSelection => ({
    models: CURATED_FALLBACK_MODELS.map((model) => ({
      ...model,
      input: [...model.input],
      cost: { ...model.cost },
      ...(model.thinkingLevelMap ? { thinkingLevelMap: { ...model.thinkingLevelMap } } : {}),
    })),
    source: "curated-fallback",
    needsAuthenticatedRefresh: true,
  });

  const applyCatalog = (selection: XaiCatalogSelection, replaceExisting: boolean) => {
    currentModels = selection.models;
    needsSessionRefresh = selection.needsAuthenticatedRefresh;
    setXaiRuntimeModels(currentModels);
    if (replaceExisting) pi.unregisterProvider(XAI_PROVIDER_ID);
    pi.registerProvider(XAI_PROVIDER_ID, providerConfig() as any);
  };

  const refreshCatalog = async (
    access: string,
    options: { forceRefresh: boolean; signal?: AbortSignal },
  ): Promise<{ selection: XaiCatalogSelection; isCurrent: boolean }> => {
    // Never coalesce across credentials: a forced login may switch accounts
    // while an older session refresh is still in flight.
    const generation = ++refreshGeneration;
    refreshAbortController?.abort();
    const controller = new AbortController();
    refreshAbortController = controller;
    const forwardAbort = () => controller.abort();
    options.signal?.addEventListener("abort", forwardAbort, { once: true });
    if (options.signal?.aborted) controller.abort();
    try {
      const selection = await selectXaiModelCatalog({
        credential: { access },
        forceRefresh: options.forceRefresh,
        signal: controller.signal,
        commitAllowed: () => generation === refreshGeneration && !controller.signal.aborted,
      });
      return {
        selection,
        isCurrent: generation === refreshGeneration && !controller.signal.aborted,
      };
    } finally {
      options.signal?.removeEventListener("abort", forwardAbort);
      if (refreshAbortController === controller) refreshAbortController = undefined;
    }
  };

  oauth = createXaiOAuth({
    getExistingCredentials: getGrokAuthCredentials,
    onLoginCredentials: async (credentials: OAuthCredentials, callbacks: OAuthLoginCallbacks) => {
      const loginGeneration = ++loginCatalogGeneration;
      activeLoginRefreshes++;
      try {
        const { selection, isCurrent } = await refreshCatalog(credentials.access, {
          forceRefresh: true,
          signal: callbacks.signal,
        });
        // Deferred refreshes cannot start while login catalog work is active.
        // If another login superseded this one, only the newest login may apply.
        if (loginGeneration !== loginCatalogGeneration || !isCurrent) return;
        applyCatalog(selection, true);
        deferredRetryAfter = selection.needsAuthenticatedRefresh ? Date.now() + 60_000 : 0;
        callbacks.onProgress?.(
          selection.source === "remote"
            ? `Refreshed ${selection.models.length} OAuth-visible xAI model${selection.models.length === 1 ? "" : "s"}.`
            : "The authenticated xAI model catalog was unavailable; using the curated fallback.",
        );
      } catch (error) {
        if (callbacks.signal?.aborted) throw error;
        if (loginGeneration === loginCatalogGeneration) {
          applyCatalog(curatedFallbackSelection(), true);
          deferredRetryAfter = Date.now() + 60_000;
          callbacks.onProgress?.(
            "The authenticated xAI model catalog was unavailable; using the curated fallback.",
          );
        }
      } finally {
        activeLoginRefreshes--;
      }
    },
  });

  const startupAuth = getStartupXaiCatalogAuth();
  const startupSelection = await selectXaiModelCatalog({
    credential: startupAuth.credential,
    refreshWhenCredentialsAvailable: startupAuth.needsRegistryRefresh,
    credentialChangedAt: startupAuth.credentialChangedAt,
  });
  applyCatalog(startupSelection, false);

  const refreshDeferredCatalog = async (ctx: any) => {
    if (activeLoginRefreshes > 0 || !needsSessionRefresh || Date.now() < deferredRetryAfter) return;
    const loginGenerationAtStart = loginCatalogGeneration;
    const lookupModel =
      ctx?.modelRegistry?.find?.(XAI_PROVIDER_ID, DEFAULT_XAI_MODEL) ||
      currentModels.map((model) => ctx?.modelRegistry?.find?.(XAI_PROVIDER_ID, model.id)).find(Boolean);
    if (!lookupModel || typeof ctx?.modelRegistry?.getApiKeyAndHeaders !== "function") {
      deferredRetryAfter = Date.now() + 5_000;
      return;
    }
    const auth = await ctx.modelRegistry.getApiKeyAndHeaders(lookupModel);
    const authorization = auth?.ok && typeof auth.headers?.Authorization === "string"
      ? auth.headers.Authorization
      : "";
    const access =
      (auth?.ok && typeof auth.apiKey === "string" && auth.apiKey) ||
      (authorization.toLowerCase().startsWith("bearer ")
        ? authorization.slice("bearer ".length)
        : "");
    if (activeLoginRefreshes > 0 || loginGenerationAtStart !== loginCatalogGeneration) return;
    if (!access) {
      deferredRetryAfter = Date.now() + 5_000;
      return;
    }
    try {
      // The bearer became available only after pi's lock-protected refresh;
      // revalidate entitlements instead of accepting a prior fresh cache.
      const { selection, isCurrent } = await refreshCatalog(access, { forceRefresh: true });
      if (isCurrent) {
        applyCatalog(selection, true);
        deferredRetryAfter = selection.needsAuthenticatedRefresh ? Date.now() + 60_000 : 0;
      }
    } catch {
      // A superseded older attempt must not shorten a newer transient
      // refresh's one-minute retry deadline.
      deferredRetryAfter = Math.max(deferredRetryAfter, Date.now() + 5_000);
    }
  };

  registerXaiTools(pi);

  if (typeof (pi as any).on === "function") {
    // Active-tool accessors belong to the ExtensionAPI (`pi`), while models
    // and pi-managed credentials are supplied by the event/context payload.
    (pi as any).on("session_start", async (_event: any, ctx: any) => {
      await refreshDeferredCatalog(ctx);
      syncXaiToolsForModel(pi, ctx?.model, { resetNetworkTools: true });
    });
    (pi as any).on("input", async (_event: any, ctx: any) => {
      await refreshDeferredCatalog(ctx);
      const activeModel = ctx?.model;
      const entitled =
        typeof activeModel?.id === "string" &&
        currentModels.some((model) => model.id.toLowerCase() === activeModel.id.toLowerCase());
      if (activeModel?.provider !== XAI_PROVIDER_ID || entitled) return { action: "continue" };

      const replacement = currentModels
        .map((model) => ctx?.modelRegistry?.find?.(XAI_PROVIDER_ID, model.id))
        .find(Boolean);
      if (replacement && (await pi.setModel(replacement))) {
        ctx?.ui?.notify?.(
          `The refreshed xAI catalog no longer includes ${activeModel.id}; switched to ${replacement.id}.`,
          "warning",
        );
        return { action: "continue" };
      }
      ctx?.ui?.notify?.(
        `The refreshed xAI catalog no longer includes ${activeModel.id}, and no entitled xAI replacement is available.`,
        "error",
      );
      return { action: "handled" };
    });
    (pi as any).on("model_select", (event: any, ctx: any) =>
      syncXaiToolsForModel(pi, event?.model ?? ctx?.model),
    );
    (pi as any).on("before_agent_start", async (_event: any, ctx: any) => {
      await refreshDeferredCatalog(ctx);
      let activeModel = ctx?.model;
      const entitled =
        typeof activeModel?.id === "string" &&
        currentModels.some((model) => model.id.toLowerCase() === activeModel.id.toLowerCase());
      if (activeModel?.provider === XAI_PROVIDER_ID && !entitled) {
        const replacement = currentModels
          .map((model) => ctx?.modelRegistry?.find?.(XAI_PROVIDER_ID, model.id))
          .find(Boolean);
        if (replacement && (await pi.setModel(replacement))) {
          activeModel = replacement;
          ctx?.ui?.notify?.(
            `The refreshed xAI catalog no longer includes ${ctx.model.id}; switched to ${replacement.id}.`,
            "warning",
          );
        } else {
          ctx?.ui?.notify?.(
            `The refreshed xAI catalog no longer includes ${activeModel.id}, and no entitled xAI replacement is available.`,
            "error",
          );
          // The provider transport also checks the active entitlement snapshot
          // and returns a local error before any network request.
        }
      }
      return syncXaiToolsForModel(pi, activeModel);
    });
  }
}
