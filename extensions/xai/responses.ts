import type { Api, Context, Model, SimpleStreamOptions } from "@earendil-works/pi-ai";
import { openAIResponsesApi } from "@earendil-works/pi-ai/compat";
import { randomUUID } from "crypto";
import { compactXaiInlineImages } from "./images";
import {
  getXaiRuntimeModel,
  isAuthenticatedXaiInputProvenance,
  isXaiRuntimeModelEntitled,
  xaiModelForRequest,
} from "./models";
import { rewriteXaiResponsesPayload, xaiResponsesPayloadContainsImage } from "./payload";
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
    redirectGuardFetch = (input, init) =>
      baseFetch(
        input,
        guardedRedirectUrls.has(fetchRequestUrl(input))
          ? { ...init, redirect: "error" }
          : init,
      );
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

function normalizeXaiStreamEvent(event: AssistantStreamEvent): AssistantStreamEvent {
  if (event.type !== "error" || !event.error || typeof event.error !== "object") return event;
  const error = event.error as Record<string, any>;
  if (typeof error.errorMessage !== "string") return event;
  return {
    ...event,
    error: {
      ...error,
      errorMessage: safeXaiTransportErrorMessage(
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
      `xAI OAuth model ${modelId} is explicitly text-only in the authenticated model catalog; no xAI request was sent`,
    );
  }
}

/** Create one xAI Responses result using explicit credential-aware routing. */
export async function createXaiResponse(
  credential: XaiCredential,
  body: Record<string, any>,
  signal?: AbortSignal,
): Promise<any> {
  const requestedModel = typeof body.model === "string" ? body.model : undefined;
  const model = xaiModelForRequest(requestedModel, credential.kind);
  if (credential.kind === "oauth-session" && !isXaiRuntimeModelEntitled(model.id)) {
    throw new Error(`xAI OAuth model ${model.id} is not present in the authenticated model catalog`);
  }
  const route = resolveXaiRoute(credential.kind, "responses");
  const rewritten = rewriteXaiResponsesPayload(body, model);
  const payload = (await compactXaiInlineImages(rewritten)) as Record<string, any>;
  if (credential.kind === "oauth-session") assertXaiRuntimeModelAcceptsPayload(model.id, payload);
  const requestSessionId = randomUUID();
  const requestHeaders = xaiProxyRequestHeaders(model.id, credential.kind, {
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
  if (!isXaiRuntimeModelEntitled(model.id)) {
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
  const requestHeaders = xaiProxyRequestHeaders(
    model.id,
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
          async onPayload(payload) {
            const rewritten = rewriteXaiResponsesPayload(payload, streamModel, {
              ...options,
              sessionId: sessionId || routingSessionId,
            });
            const userRewritten = await options?.onPayload?.(rewritten, streamModel);
            const finalPayload = await compactXaiInlineImages(
              userRewritten === undefined ? rewritten : userRewritten,
            );
            assertXaiRuntimeModelAcceptsPayload(streamModel.id, finalPayload);
            return finalPayload;
          },
        },
      );
      for await (const event of inner as AsyncIterable<AssistantStreamEvent>) {
        if (event.type === "done" || event.type === "error") releaseRedirectGuard();
        stream.push(normalizeXaiStreamEvent(event));
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
