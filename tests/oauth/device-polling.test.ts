import { describe, expect, it } from "vitest";
import { pollXaiDeviceAuthorization } from "../../extensions/xai/device-auth";
import {
  XAI_OAUTH_CLIENT_ID,
  XAI_OAUTH_DEVICE_GRANT_TYPE,
  XAI_OAUTH_TOKEN_URL,
} from "../../extensions/xai/constants";
import {
  deviceFixture,
  jsonResponse,
  makeClock,
  tokenPayload,
} from "../fixtures/device";

describe("device token polling", () => {
  it("waits before polling and cumulatively applies slow_down", async () => {
    const clock = makeClock();
    const requests: Array<{ at: number; url: string; init: RequestInit }> = [];
    const responses = [
      jsonResponse({ error: "authorization_pending" }, 400),
      jsonResponse({ error: "slow_down", interval: 4 }, 400),
      jsonResponse({ error: "slow_down" }, 400),
      jsonResponse({ error: "authorization_pending" }, 400),
      jsonResponse(tokenPayload()),
    ];
    const result = await pollXaiDeviceAuthorization(
      deviceFixture({ intervalSeconds: 2 }),
      {
        now: clock.now,
        sleep: clock.sleep,
        fetchImpl: async (url, init) => {
          requests.push({ at: clock.now(), url: String(url), init: init! });
          return responses.shift()!;
        },
      },
    );
    expect(clock.sleeps).toEqual([2000, 2000, 7000, 12000, 12000]);
    expect(requests.map(({ at }) => at)).toEqual([
      1_002_000, 1_004_000, 1_011_000, 1_023_000, 1_035_000,
    ]);
    for (const request of requests) {
      expect(request.url).toBe(XAI_OAUTH_TOKEN_URL);
      expect(request.init).toMatchObject({ method: "POST", redirect: "error" });
      expect(
        Object.fromEntries(new URLSearchParams(String(request.init.body))),
      ).toEqual({
        grant_type: XAI_OAUTH_DEVICE_GRANT_TYPE,
        device_code: "opaque-device-code",
        client_id: XAI_OAUTH_CLIENT_ID,
      });
    }
    expect(result).toEqual({
      access_token: "device-access-token",
      refresh_token: "device-refresh-token",
      expires_in: 3600,
      token_type: "Bearer",
    });
    expect(result).not.toHaveProperty("id_token");
  });

  it("uses the RFC default interval before the first request", async () => {
    const clock = makeClock();
    let first = 0;
    await pollXaiDeviceAuthorization(
      deviceFixture({ intervalSeconds: undefined }),
      {
        now: clock.now,
        sleep: clock.sleep,
        fetchImpl: async () => {
          first = clock.now();
          return jsonResponse(tokenPayload());
        },
      },
    );
    expect(first).toBe(1_005_000);
  });

  it("stops at local expiry without a tight or late poll", async () => {
    const clock = makeClock();
    let polls = 0;
    await expect(
      pollXaiDeviceAuthorization(
        deviceFixture({ intervalSeconds: 2, expiresInSeconds: 3 }),
        {
          now: clock.now,
          sleep: clock.sleep,
          fetchImpl: async () => {
            polls++;
            return jsonResponse({ error: "authorization_pending" }, 400);
          },
        },
      ),
    ).rejects.toThrow(/expired/);
    expect(clock.sleeps).toEqual([2000, 1000]);
    expect(polls).toBe(1);
  });

  it.each([
    [
      "denied",
      jsonResponse(
        { error: "access_denied", error_description: "DENIAL_SECRET" },
        400,
      ),
      /was denied/,
    ],
    [
      "authorization denied",
      jsonResponse({ error: "authorization_denied" }, 400),
      /was denied/,
    ],
    ["expired", jsonResponse({ error: "expired_token" }, 400), /expired/],
    [
      "unknown OAuth error",
      jsonResponse(
        { error: "unknown_error", error_description: "UNKNOWN_SECRET" },
        400,
      ),
      /authorization failed/,
    ],
    ["missing OAuth error", jsonResponse({}, 400), /invalid schema/],
    ["rate limited", jsonResponse({}, 429), /status 429/],
    ["server error", jsonResponse({}, 503), /status 503/],
    [
      "non-json error",
      new Response("bad gateway", { status: 400 }),
      /status 400/,
    ],
    [
      "missing access",
      jsonResponse({ refresh_token: "refresh" }),
      /access token/,
    ],
    [
      "missing refresh",
      jsonResponse({ access_token: "access" }),
      /refresh token/,
    ],
    [
      "bad expiry",
      jsonResponse(tokenPayload({ expires_in: "3600" })),
      /invalid schema/,
    ],
  ])(
    "maps %s to a redacted terminal error",
    async (_label, response, pattern) => {
      const clock = makeClock();
      const error = await pollXaiDeviceAuthorization(
        deviceFixture({ intervalSeconds: 1 }),
        { now: clock.now, sleep: clock.sleep, fetchImpl: async () => response },
      ).then(
        () => {
          throw new Error("expected polling failure");
        },
        (value: unknown) => value as Error,
      );
      expect(error.message).toMatch(pattern);
      expect(error.message).not.toMatch(
        /DENIAL_SECRET|UNKNOWN_SECRET|device-access-token|device-refresh-token|opaque-device-code/,
      );
    },
  );

  it("rejects malformed slow_down intervals", async () => {
    const clock = makeClock();
    await expect(
      pollXaiDeviceAuthorization(deviceFixture({ intervalSeconds: 1 }), {
        now: clock.now,
        sleep: clock.sleep,
        fetchImpl: async () =>
          jsonResponse({ error: "slow_down", interval: "10" }, 400),
      }),
    ).rejects.toThrow(/invalid schema/);
  });

  it("bounds and cancels oversized streamed token bodies", async () => {
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
    const clock = makeClock();
    await expect(
      pollXaiDeviceAuthorization(deviceFixture({ intervalSeconds: 1 }), {
        now: clock.now,
        sleep: clock.sleep,
        fetchImpl: async () =>
          new Response(stream, {
            headers: { "Content-Type": "application/json" },
          }),
      }),
    ).rejects.toThrow(/too large/);
    expect(pulls).toBeLessThanOrEqual(66);
    expect(cancelled).toBe(true);
  });
});
