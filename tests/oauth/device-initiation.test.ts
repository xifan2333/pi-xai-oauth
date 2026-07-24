import { describe, expect, it, vi } from "vitest";
import { requestXaiDeviceAuthorization } from "../../extensions/xai/device-auth";
import {
  XAI_CLIENT_IDENTIFIER,
  XAI_CLIENT_VERSION,
  XAI_OAUTH_CLIENT_ID,
  XAI_OAUTH_DEVICE_URL,
  XAI_OAUTH_SCOPE,
  XAI_USER_AGENT,
} from "../../extensions/xai/constants";
import { devicePayload, jsonResponse } from "../fixtures/device";

describe("device authorization initiation", () => {
  it("uses the pinned endpoint and returns only safe bounded UI data", async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn(async (_url: any, _init: any) =>
      jsonResponse(
        devicePayload({
          verification_uri_complete:
            "https://auth.x.ai/device?secret=opaque-device-code",
          expires_in: 3600,
        }),
      ),
    );
    const result = await requestXaiDeviceAuthorization(
      { clientSurface: "ui", fetchImpl },
      controller.signal,
    );
    expect(result).toEqual({
      deviceCode: "opaque-device-code",
      userCode: "ABCD-EFGH",
      verificationUri: "https://auth.x.ai/device",
      intervalSeconds: 5,
      expiresInSeconds: 900,
    });
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0];
    expect(String(url)).toBe(XAI_OAUTH_DEVICE_URL);
    expect(init).toMatchObject({
      method: "POST",
      redirect: "error",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": XAI_USER_AGENT,
        "X-Grok-Client-Version": XAI_CLIENT_VERSION,
        "X-Grok-Client-Surface": "ui",
      },
    });
    expect(Object.fromEntries(new URLSearchParams(String(init.body)))).toEqual({
      client_id: XAI_OAUTH_CLIENT_ID,
      scope: XAI_OAUTH_SCOPE,
      referrer: XAI_CLIENT_IDENTIFIER,
    });
  });

  it.each([
    ["empty device code", { device_code: "" }],
    ["invalid user code", { user_code: "BAD CODE" }],
    ["foreign URI", { verification_uri: "https://evil.example/device" }],
    ["non-https URI", { verification_uri: "javascript:alert(1)" }],
    [
      "credentialed URI",
      { verification_uri: "https://user:pass@auth.x.ai/device" },
    ],
    ["fragment URI", { verification_uri: "https://auth.x.ai/device#secret" }],
    [
      "query secret",
      {
        verification_uri: "https://auth.x.ai/device?opaque=opaque-device-code",
      },
    ],
    [
      "encoded query secret",
      {
        verification_uri:
          "https://auth.x.ai/device?opaque=opaque%2Ddevice%2Dcode",
      },
    ],
    [
      "double-encoded secret",
      {
        verification_uri:
          "https://auth.x.ai/device?opaque=opaque%252Ddevice%252Dcode",
      },
    ],
    [
      "path secret",
      { verification_uri: "https://auth.x.ai/opaque%2Ddevice%2Dcode" },
    ],
    [
      "equals-delimited secret",
      {
        device_code: "abc=def",
        verification_uri: "https://auth.x.ai/device?abc=def",
      },
    ],
    [
      "ampersand-delimited secret",
      {
        device_code: "abc&def",
        verification_uri: "https://auth.x.ai/device?abc&def",
      },
    ],
    [
      "question-delimited secret",
      {
        device_code: "abc?def",
        verification_uri: "https://auth.x.ai/device?abc?def",
      },
    ],
    ["trusted-hostname device code", { device_code: "auth.x.ai" }],
    ["bad expiry", { expires_in: 0 }],
    ["bad interval", { interval: 0 }],
    ["string interval", { interval: "5" }],
  ])("rejects %s", async (_label, overrides) => {
    await expect(
      requestXaiDeviceAuthorization({
        fetchImpl: async () => jsonResponse(devicePayload(overrides)),
      }),
    ).rejects.toThrow(/invalid schema/);
  });

  it("rejects non-JSON, invalid JSON, and declared oversized responses", async () => {
    await expect(
      requestXaiDeviceAuthorization({
        fetchImpl: async () => new Response("not json"),
      }),
    ).rejects.toThrow(/did not return JSON/);
    await expect(
      requestXaiDeviceAuthorization({
        fetchImpl: async () =>
          new Response("{", {
            headers: { "Content-Type": "application/json" },
          }),
      }),
    ).rejects.toThrow(/invalid JSON/);
    await expect(
      requestXaiDeviceAuthorization({
        fetchImpl: async () =>
          jsonResponse({}, 200, { "Content-Length": "70000" }),
      }),
    ).rejects.toThrow(/too large/);
  });

  it("bounds and cancels oversized streamed bodies", async () => {
    let pulls = 0;
    let cancelled = false;
    const stream = new ReadableStream({
      pull(controller) {
        pulls++;
        controller.enqueue(new Uint8Array(1024));
        if (pulls >= 100) controller.close();
      },
      cancel() {
        cancelled = true;
      },
    });
    await expect(
      requestXaiDeviceAuthorization({
        fetchImpl: async () =>
          new Response(stream, {
            headers: { "Content-Type": "application/json" },
          }),
      }),
    ).rejects.toThrow(/too large/);
    expect(pulls).toBeLessThanOrEqual(66);
    expect(cancelled).toBe(true);
  });

  it("uses safe status and network errors", async () => {
    await expect(
      requestXaiDeviceAuthorization({
        fetchImpl: async () => jsonResponse({}, 404),
      }),
    ).rejects.toThrow(/not available.*browser login/);
    await expect(
      requestXaiDeviceAuthorization({
        fetchImpl: async () => jsonResponse({}, 503),
      }),
    ).rejects.toThrow(/status 503/);
    const error = await requestXaiDeviceAuthorization({
      fetchImpl: async () => {
        throw new Error("secret network detail");
      },
    }).then(
      () => {
        throw new Error("expected request failure");
      },
      (value: unknown) => value as Error,
    );
    expect(error.message).toBe("xAI device authorization request failed");
    expect(error.message).not.toContain("secret network detail");
  });
});
