import { describe, expect, it, vi } from "vitest";
import {
  fetchXaiUsage,
  XaiUsageError,
} from "../../extensions/xai/usage";
import { XAI_CLI_BILLING_URL, XAI_CLI_USER_URL } from "../../extensions/xai/constants";
import { headerValue, jsonResponse } from "../fixtures/http";
import newCredits from "../fixtures/usage/credits-new.json";
import identity from "../fixtures/usage/identity.json";

const credential = { kind: "oauth-session" as const, token: "SECRET_BEARER_82" };

async function capturedError(promise: Promise<unknown>): Promise<Error> {
  try {
    await promise;
  } catch (error) {
    return error as Error;
  }
  throw new Error("expected request to fail");
}

describe("xAI usage transport", () => {
  it("uses the pinned identity-first contract and required proxy metadata", async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      requests.push({ url, init });
      return url === XAI_CLI_USER_URL ? jsonResponse(identity) : jsonResponse(newCredits);
    }));

    const usage = await fetchXaiUsage(credential);
    expect(usage.creditUsagePercent).toBe(42.5);
    expect(requests.map(({ url }) => url)).toEqual([XAI_CLI_USER_URL, XAI_CLI_BILLING_URL]);
    for (const request of requests) {
      expect(request.init).toMatchObject({ method: "GET", redirect: "error" });
      expect(headerValue(request.init?.headers, "Authorization")).toBe("Bearer SECRET_BEARER_82");
      expect(headerValue(request.init?.headers, "X-XAI-Token-Auth")).toBe("xai-grok-cli");
      expect(headerValue(request.init?.headers, "x-grok-client-version")).toMatch(/^\d+\.\d+\.\d+/);
      expect(headerValue(request.init?.headers, "x-grok-client-mode")).toMatch(/interactive|headless/);
    }
    expect(headerValue(requests[0]?.init?.headers, "x-userid")).toBeUndefined();
    expect(headerValue(requests[1]?.init?.headers, "x-userid")).toBe("user-fixture-82");
    expect(JSON.stringify(usage)).not.toMatch(/SECRET_BEARER_82|user-fixture-82/);
  });

  it.each([
    ["missing identity", jsonResponse({})],
    ["identity auth failure", jsonResponse({ error: "SECRET_BODY" }, 401)],
    ["identity redirect", jsonResponse({}, 302, { Location: "https://attacker.invalid" })],
    ["malformed identity", new Response("{not-json")],
    ["oversized identity", new Response("x".repeat(64 * 1024 + 1))],
  ])("fails closed before billing on %s", async (_label, response) => {
    const fetchMock = vi.fn(async () => response);
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchXaiUsage(credential)).rejects.toBeInstanceOf(XaiUsageError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("bounds billing bodies and never reflects response or transport secrets", async () => {
    const bodies = [
      jsonResponse({ error: "RAW_BILLING_SECRET" }, 500),
      new Response("x".repeat(64 * 1024 + 1)),
    ];
    for (const billingResponse of bodies) {
      const fetchMock = vi.fn(async (input: string | URL | Request) =>
        String(input) === XAI_CLI_USER_URL ? jsonResponse(identity) : billingResponse);
      vi.stubGlobal("fetch", fetchMock);
      const error = await capturedError(fetchXaiUsage(credential));
      expect(error).toBeInstanceOf(XaiUsageError);
      expect(error.message).not.toMatch(/RAW_BILLING_SECRET|SECRET_BEARER_82|user-fixture-82/);
    }

    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("transport leaked SECRET_BEARER_82");
    }));
    const transportError = await capturedError(fetchXaiUsage(credential));
    expect(transportError.message).toBe("xAI usage request failed.");
  });

  it("propagates cancellation safely before billing", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn(async (_input: string | URL | Request, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("SECRET", "AbortError")), { once: true });
      }));
    vi.stubGlobal("fetch", fetchMock);
    const request = fetchXaiUsage(credential, controller.signal);
    controller.abort();
    const error = await request.catch((caught) => caught as XaiUsageError);
    expect(error).toMatchObject({ code: "cancelled", message: "xAI usage request was cancelled." });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("applies the 15-second timeout without leaking fetch errors", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(async (_input: string | URL | Request, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("SECRET_TIMEOUT")), { once: true });
      })));
    const request = fetchXaiUsage(credential).catch((error) => error as XaiUsageError);
    await vi.advanceTimersByTimeAsync(15_000);
    await expect(request).resolves.toMatchObject({
      code: "timeout",
      message: "xAI usage request timed out.",
    });
  });

  it("rejects API-key provenance before any request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchXaiUsage({ kind: "api-key", token: "SECRET" })).rejects.toMatchObject({
      code: "auth",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
