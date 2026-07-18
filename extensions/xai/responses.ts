import type { Api, Context, Model, SimpleStreamOptions } from "@earendil-works/pi-ai";
import { openAIResponsesApi } from "@earendil-works/pi-ai/compat";
import { randomUUID } from "crypto";
import { compactXaiInlineImages } from "./images";
import {
  getXaiRuntimeModel,
  isAuthenticatedXaiInputProvenance,
  normalizedXaiModelId,
  xaiModelForRequest,
} from "./models";
import {
  applyXaiOAuthResponsesPolicy,
  canonicalizeXaiResponsesPayload,
  exposeGrokNativeToolNames,
  internalizeGrokNativeToolCalls,
  rewriteXaiResponsesPayload,
  type GrokNativeToolRoutes,
  XAI_PAYLOAD_CANONICALIZATION_ERROR,
  xaiPayloadGrokNativeToolRoutes,
  xaiResponsesPayloadContainsImage,
} from "./payload";
import { resolveXaiRoute, type XaiCredential } from "./routing";
import {
  safeXaiTransportErrorMessage,
  scrubXaiReservedHeaders,
  xaiHttpErrorFromResponse,
  xaiJsonPostHeaders,
  xaiProxyRequestHeaders,
} from "./wire";

type AssistantStreamEvent = Record<string, any>;

const streamSimpleOpenAIResponses = openAIResponsesApi().streamSimple;
const SAFE_TEXT_ONLY_ERROR_PATTERN =
  /^xAI OAuth model [A-Za-z0-9][A-Za-z0-9._:-]{0,127} is explicitly text-only in the authenticated model catalog; no xAI request was sent$/;
const SAFE_PAYLOAD_MODEL_ERROR =
  "xAI OAuth payload hooks cannot change the selected model; no xAI request was sent";

const guardedRedirectUrls = new Map<string, number>();
let unguardedFetch: typeof fetch | undefined;
let redirectGuardFetch: typeof fetch | undefined;

function fetchRequestUrl(input: string | URL | Request): string {
  return input instanceof Request ? input.url : String(input);
}

function acquireRedirectGuard(url: string): () => void {
  if (!redirectGuardFetch) {
    unguardedFetch = globalThis.fetch;
    const baseFetch = unguardedFetch;
    redirectGuardFetch = async (input, init) => {
      const url = fetchRequestUrl(input);
      const guarded = guardedRedirectUrls.has(url);
      const response = await baseFetch(
        input,
        guarded ? { ...init, redirect: "error" } : init,
      );
      if (!guarded || response.ok) return response;
      const error = await xaiHttpErrorFromResponse(response, url);
      const marker = error.code === "encrypted-content-mismatch"
        ? "encrypted_content"
        : error.code === "proxy-version-gate"
          ? "update_required"
          : "request failed";
      return new Response(JSON.stringify({ error: { message: marker } }), {
        status: response.status,
        statusText: response.statusText,
        headers: { "Content-Type": "application/json" },
      });
    };
    globalThis.fetch = redirectGuardFetch;
  }
  guardedRedirectUrls.set(url, (guardedRedirectUrls.get(url) ?? 0) + 1);

  let released = false;
  return () => {
    if (released) return;
    released = true;
    const remaining = (guardedRedirectUrls.get(url) ?? 1) - 1;
    if (remaining > 0) guardedRedirectUrls.set(url, remaining);
    else guardedRedirectUrls.delete(url);
    if (guardedRedirectUrls.size === 0) {
      if (globalThis.fetch === redirectGuardFetch && unguardedFetch) {
        globalThis.fetch = unguardedFetch;
      }
      redirectGuardFetch = undefined;
      unguardedFetch = undefined;
    }
  };
}

function resultFromStreamEvent(event: AssistantStreamEvent): any {
  if (event.type === "done") return event.message;
  if (event.type === "error") return event.error;
  return undefined;
}

function normalizeXaiErrorText(value: string): string {
  return /^OpenAI API error\b/i.test(value)
    ? safeXaiTransportErrorMessage(value, undefined, "responses-proxy")
    : value;
}

function restoreXaiMessageIdentity(value: unknown, model: Model<Api>): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const message = value as Record<string, unknown>;
  if (message.role !== "assistant") return value;
  return {
    ...message,
    api: model.api,
    provider: model.provider,
    model: model.id,
  };
}

function normalizeXaiStreamEvent(
  event: AssistantStreamEvent,
  grokNativeToolRoutes: GrokNativeToolRoutes,
  model: Model<Api>,
): AssistantStreamEvent {
  const partial = internalizeGrokNativeToolCalls(
    restoreXaiMessageIdentity(event.partial, model),
    grokNativeToolRoutes,
  );
  const toolCall = internalizeGrokNativeToolCalls(event.toolCall, grokNativeToolRoutes);
  const message = internalizeGrokNativeToolCalls(
    restoreXaiMessageIdentity(event.message, model),
    grokNativeToolRoutes,
  );
  const restoredError = restoreXaiMessageIdentity(event.error, model);
  const internalized =
    partial !== event.partial || toolCall !== event.toolCall ||
      message !== event.message || restoredError !== event.error
      ? { ...event, partial, toolCall, message, error: restoredError }
      : event;
  if (internalized.type !== "error" || !internalized.error || typeof internalized.error !== "object") {
    return internalized;
  }
  const error = internalized.error as Record<string, any>;
  if (typeof error.errorMessage !== "string") return internalized;
  return {
    ...internalized,
    error: {
      ...error,
      errorMessage:
        SAFE_TEXT_ONLY_ERROR_PATTERN.test(error.errorMessage) ||
        error.errorMessage === SAFE_PAYLOAD_MODEL_ERROR ||
        error.errorMessage === XAI_PAYLOAD_CANONICALIZATION_ERROR
        ? error.errorMessage
        : safeXaiTransportErrorMessage(
            error.errorMessage,
            typeof error.status === "number" ? error.status : undefined,
            "responses-proxy",
          ),
    },
  };
}

function createForwardingAssistantStream() {
  const queue: AssistantStreamEvent[] = [];
  const waiting: Array<(result: IteratorResult<AssistantStreamEvent>) => void> = [];
  let done = false;
  let resolveResult: (result: any) => void = () => {};
  const resultPromise = new Promise<any>((resolve) => {
    resolveResult = resolve;
  });

  function finish(result: any) {
    if (done) return;
    done = true;
    resolveResult(result);
  }

  return {
    push(event: AssistantStreamEvent) {
      const finalResult = resultFromStreamEvent(event);
      const isTerminal = event.type === "done" || event.type === "error";
      if (isTerminal) finish(finalResult);
      if (done && !isTerminal) return;
      const waiter = waiting.shift();
      if (waiter) {
        waiter({ value: event, done: false });
      } else {
        queue.push(event);
      }
    },
    end(result?: any) {
      finish(result);
      while (waiting.length > 0) {
        waiting.shift()?.({ value: undefined as any, done: true });
      }
    },
    result() {
      return resultPromise;
    },
    async *[Symbol.asyncIterator]() {
      while (true) {
        if (queue.length > 0) {
          yield queue.shift()!;
        } else if (done) {
          return;
        } else {
          const result = await new Promise<IteratorResult<AssistantStreamEvent>>((resolve) => waiting.push(resolve));
          if (result.done) return;
          yield result.value;
        }
      }
    },
  };
}

function streamErrorMessage(model: Model<Api>, error: unknown) {
  return {
    role: "assistant",
    content: [],
    api: model.api,
    provider: model.provider,
    model: model.id,
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason: "error",
    errorMessage: normalizeXaiErrorText(error instanceof Error ? error.message : String(error)),
    timestamp: Date.now(),
  };
}

/** POST a JSON body to an xAI endpoint with bearer authentication. */
export async function postXaiJson(
  authToken: string,
  url: string,
  body: Record<string, any>,
  signal?: AbortSignal,
  contractHeaders: Record<string, string> = {},
): Promise<any> {
  const response = await fetch(url, {
    method: "POST",
    headers: xaiJsonPostHeaders(authToken, contractHeaders),
    body: JSON.stringify(body),
    redirect: "error",
    signal,
  });

  if (!response.ok) {
    throw await xaiHttpErrorFromResponse(response, url);
  }

  return response.json();
}

function pinXaiPayloadModel(modelId: string, payload: unknown): void {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error(SAFE_PAYLOAD_MODEL_ERROR);
  }
  const body = payload as Record<string, unknown>;
  if (
    body.model !== undefined &&
    (typeof body.model !== "string" ||
      normalizedXaiModelId(body.model) !== normalizedXaiModelId(modelId))
  ) {
    throw new Error(SAFE_PAYLOAD_MODEL_ERROR);
  }
  body.model = modelId;
}

/** Assert the current authenticated entitlement permits the final Responses payload. */
export function assertXaiRuntimeModelAcceptsPayload(modelId: string, payload: unknown): void {
  const runtimeModel = getXaiRuntimeModel(modelId);
  if (!runtimeModel) {
    throw new Error(`xAI OAuth model ${modelId} is not present in the authenticated model catalog`);
  }
  if (
    isAuthenticatedXaiInputProvenance(runtimeModel.inputProvenance) &&
    !runtimeModel.input.includes("image") &&
    xaiResponsesPayloadContainsImage(payload)
  ) {
    throw new Error(
      `xAI OAuth model ${runtimeModel.id} is explicitly text-only in the authenticated model catalog; no xAI request was sent`,
    );
  }
}

/** Create one xAI Responses result using explicit credential-aware routing. */
export async function createXaiResponse(
  credential: XaiCredential,
  body: Record<string, any>,
  signal?: AbortSignal,
): Promise<any> {
  const canonicalBody = canonicalizeXaiResponsesPayload(body);
  const requestedModel = typeof canonicalBody.model === "string" ? canonicalBody.model : undefined;
  const model = xaiModelForRequest(requestedModel, credential.kind);
  const runtimeModel = credential.kind === "oauth-session"
    ? getXaiRuntimeModel(model.id)
    : undefined;
  if (credential.kind === "oauth-session" && !runtimeModel) {
    throw new Error(`xAI OAuth model ${model.id} is not present in the authenticated model catalog`);
  }
  const selectedModelId = runtimeModel?.id ?? model.id;
  const requestModel = selectedModelId === model.id ? model : { ...model, id: selectedModelId };
  const route = resolveXaiRoute(credential.kind, "responses");
  const rewritten = rewriteXaiResponsesPayload(canonicalBody, requestModel);
  const policyPayload = credential.kind === "oauth-session"
    ? applyXaiOAuthResponsesPolicy(rewritten as Record<string, unknown>)
    : rewritten;
  pinXaiPayloadModel(selectedModelId, policyPayload);
  if (credential.kind === "oauth-session") {
    assertXaiRuntimeModelAcceptsPayload(selectedModelId, policyPayload);
  }
  const payload = (await compactXaiInlineImages(policyPayload)) as Record<string, any>;
  if (credential.kind === "oauth-session") {
    assertXaiRuntimeModelAcceptsPayload(selectedModelId, payload);
  }
  const requestSessionId = randomUUID();
  const requestHeaders = xaiProxyRequestHeaders(selectedModelId, credential.kind, {
    conversationId: requestSessionId,
    requestId: randomUUID(),
    sessionId: requestSessionId,
  });
  return postXaiJson(credential.token, route.url, payload, signal, requestHeaders);
}

/**
 * Stream pi's simple Responses flow through xAI with payload normalization.
 *
 * The transport is delegated to pi's builtin OpenAI Responses helper with a
 * temporary `openai-responses` API tag, while xAI routing headers, request
 * URLs, and payload rewriting continue to use the original xAI model metadata.
 * Returned events are forwarded through an assistant stream exposing async
 * iteration and `result()`. Delegate load or stream failures are converted
 * into terminal error events with xAI provider metadata instead of escaping
 * as unstructured promise failures.
 *
 * @param model xAI provider model selected by pi.
 * @param context Conversation messages and tool context to stream.
 * @param options Simple stream options, including OAuth token, session ID, cancellation, and payload hooks.
 * @returns A forwarding assistant stream compatible with pi's async iterator and `result()` contract.
 */
export function streamSimpleXaiResponses(model: Model<Api>, context: Context, options?: SimpleStreamOptions) {
  const runtimeModel = getXaiRuntimeModel(model.id);
  if (!runtimeModel) {
    const stream = createForwardingAssistantStream();
    const message = streamErrorMessage(
      model,
      new Error(`xAI OAuth model ${model.id} is not present in the authenticated model catalog`),
    );
    stream.push({ type: "error", reason: "error", error: message });
    stream.end(message);
    return stream;
  }

  // The registered xai-auth provider is OAuth-only, so bind its stream to
  // session-token routing instead of inferring credential provenance from the
  // bearer string.
  const credentialKind = "oauth-session" as const;
  const route = resolveXaiRoute(credentialKind, "responses");

  // Prefer pi's stable session id for cache and proxy routing. A UUID fallback
  // keeps every OAuth proxy request fully attributed when pi has no session id.
  // https://docs.x.ai/developers/advanced-api-usage/prompt-caching/maximizing-cache-hits
  const sessionId = options?.sessionId;
  const routingSessionId = sessionId || randomUUID();
  const selectedModelId = runtimeModel.id;
  const requestHeaders = xaiProxyRequestHeaders(
    selectedModelId,
    credentialKind,
    {
      conversationId: routingSessionId,
      requestId: randomUUID(),
      sessionId: routingSessionId,
    },
    { streaming: true },
  );
  const streamModel = {
    ...model,
    id: selectedModelId,
    baseUrl: route.baseUrl,
    headers: scrubXaiReservedHeaders((model as any).headers) as Record<string, string>,
  };
  // Keep the xAI stream model for routing/payload rewriting, but delegate with
  // the API tag expected by pi's OpenAI Responses transport.
  const openAIResponsesModel = {
    ...streamModel,
    api: "openai-responses" as const,
  };
  // The OAuth bearer comes only from options.apiKey. Required proxy metadata
  // is merged last so callers cannot spoof authentication or attribution.
  const headers = { ...scrubXaiReservedHeaders(options?.headers), ...requestHeaders };

  const stream = createForwardingAssistantStream();
  let grokNativeToolRoutes: GrokNativeToolRoutes = {};
  void (async () => {
    // Pi's generic OpenAI delegate does not expose fetch redirect controls.
    // Keep one URL-scoped guard installed only for the lifetime of active xAI
    // streams; unrelated requests pass through unchanged, and overlapping xAI
    // streams share the same guard until the last request completes.
    const releaseRedirectGuard = acquireRedirectGuard(route.url);
    try {
      const inner = streamSimpleOpenAIResponses(
        openAIResponsesModel as Model<"openai-responses">,
        context,
        {
          ...options,
          // Prevent Pi's generic OpenAI delegate from adding its own
          // session_id/x-client-request-id affinity headers. The xAI payload
          // rewrite below still receives the stable session for cache keys.
          sessionId: undefined,
          headers,
          // A retry would reuse a once-validated payload after the current
          // entitlement snapshot may have changed. Higher layers can retry by
          // starting a fresh request that repeats every local guard.
          maxRetries: 0,
          async onPayload(payload) {
            const rewritten = rewriteXaiResponsesPayload(payload, streamModel, {
              ...options,
              sessionId: sessionId || routingSessionId,
            });
            const userRewritten = await options?.onPayload?.(rewritten, streamModel);
            const canonicalPayload = canonicalizeXaiResponsesPayload(
              userRewritten === undefined ? rewritten : userRewritten,
            );
            const policyPayload = applyXaiOAuthResponsesPolicy(canonicalPayload);
            grokNativeToolRoutes = xaiPayloadGrokNativeToolRoutes(policyPayload);
            const exposedPayload = exposeGrokNativeToolNames(policyPayload);
            pinXaiPayloadModel(selectedModelId, exposedPayload);
            assertXaiRuntimeModelAcceptsPayload(selectedModelId, exposedPayload);
            const finalPayload = await compactXaiInlineImages(
              exposedPayload,
            );
            assertXaiRuntimeModelAcceptsPayload(selectedModelId, finalPayload);
            return finalPayload;
          },
        },
      );
      for await (const event of inner as AsyncIterable<AssistantStreamEvent>) {
        if (event.type === "done" || event.type === "error") releaseRedirectGuard();
        stream.push(normalizeXaiStreamEvent(event, grokNativeToolRoutes, model));
      }
      releaseRedirectGuard();
      stream.end();
    } catch (error) {
      releaseRedirectGuard();
      const message = streamErrorMessage(model, error);
      stream.push({ type: "error", reason: "error", error: message });
      stream.end(message);
    } finally {
      releaseRedirectGuard();
    }
  })();
  return stream;
}
