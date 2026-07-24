import { getEventListeners } from "node:events";
import { describe, expect, it } from "vitest";
import {
  pollXaiDeviceAuthorization,
  requestXaiDeviceAuthorization,
} from "../../extensions/xai/device-auth";
import {
  deviceFixture,
  devicePayload,
  jsonResponse,
  makeClock,
  tokenPayload,
} from "../fixtures/device";

describe("device cancellation and timeouts", () => {
  it("pre-abort prevents initiation", async () => {
    const controller = new AbortController();
    controller.abort();
    let requests = 0;
    await expect(
      requestXaiDeviceAuthorization(
        {
          fetchImpl: async () => {
            requests++;
            return jsonResponse(devicePayload());
          },
        },
        controller.signal,
      ),
    ).rejects.toThrow("Login cancelled");
    expect(requests).toBe(0);
  });

  it("aborts an in-flight initiation", async () => {
    const controller = new AbortController();
    let requestSignal: AbortSignal | undefined;
    const pending = requestXaiDeviceAuthorization(
      {
        fetchImpl: async (_url, init) => {
          requestSignal = init?.signal as AbortSignal;
          queueMicrotask(() => controller.abort());
          return new Promise<Response>(() => {});
        },
      },
      controller.signal,
    );
    await expect(pending).rejects.toThrow("Login cancelled");
    expect(requestSignal?.aborted).toBe(true);
  });

  it("cancellation during initial wait prevents polling", async () => {
    const controller = new AbortController();
    let polls = 0;
    await expect(
      pollXaiDeviceAuthorization(
        deviceFixture(),
        {
          now: () => 0,
          sleep: async (_ms, signal) =>
            new Promise((_resolve, reject) => {
              signal?.addEventListener(
                "abort",
                () => reject(new Error("aborted")),
                { once: true },
              );
              controller.abort();
            }),
          fetchImpl: async () => {
            polls++;
            return jsonResponse(tokenPayload());
          },
        },
        controller.signal,
      ),
    ).rejects.toThrow(/cancelled/);
    expect(polls).toBe(0);
  });

  it("aborts an in-flight token request", async () => {
    const controller = new AbortController();
    const clock = makeClock();
    let requestSignal: AbortSignal | undefined;
    const pending = pollXaiDeviceAuthorization(
      deviceFixture({ intervalSeconds: 1 }),
      {
        now: clock.now,
        sleep: clock.sleep,
        fetchImpl: async (_url, init) => {
          requestSignal = init?.signal as AbortSignal;
          queueMicrotask(() => controller.abort());
          return new Promise<Response>(() => {});
        },
      },
      controller.signal,
    );
    await expect(pending).rejects.toThrow("Login cancelled");
    expect(requestSignal?.aborted).toBe(true);
  });

  it("ignores a token response arriving after expiry", async () => {
    const clock = makeClock();
    await expect(
      pollXaiDeviceAuthorization(
        deviceFixture({ intervalSeconds: 1, expiresInSeconds: 2 }),
        {
          now: clock.now,
          sleep: clock.sleep,
          fetchImpl: async () => {
            await clock.sleep(2000);
            return jsonResponse(tokenPayload());
          },
        },
      ),
    ).rejects.toThrow(/expired/);
  });

  it("times out and aborts hung fetch and body reads", async () => {
    let fetchSignal: AbortSignal | undefined;
    await expect(
      requestXaiDeviceAuthorization({
        requestTimeoutMs: 5,
        fetchImpl: async (_url, init) => {
          fetchSignal = init?.signal as AbortSignal;
          return new Promise<Response>(() => {});
        },
      }),
    ).rejects.toThrow(/timed out/);
    expect(fetchSignal?.aborted).toBe(true);
    let bodySignal: AbortSignal | undefined;
    const response = {
      ok: true,
      status: 200,
      headers: new Headers({ "Content-Type": "application/json" }),
      body: null,
      text: async () => new Promise<string>(() => {}),
    } as Response;
    await expect(
      requestXaiDeviceAuthorization({
        requestTimeoutMs: 5,
        fetchImpl: async (_url, init) => {
          bodySignal = init?.signal as AbortSignal;
          return response;
        },
      }),
    ).rejects.toThrow(/timed out/);
    expect(bodySignal?.aborted).toBe(true);
  });

  it("observes synchronous abort and fetch rejection", async () => {
    const controller = new AbortController();
    await expect(
      requestXaiDeviceAuthorization(
        {
          fetchImpl: async () => {
            controller.abort();
            throw new Error("late rejection");
          },
        },
        controller.signal,
      ),
    ).rejects.toThrow("Login cancelled");
  });

  it("reports cancellation when a response body aborts before rejecting", async () => {
    const controller = new AbortController();
    const response = {
      ok: true,
      status: 200,
      headers: new Headers({ "Content-Type": "application/json" }),
      body: null,
      text: async () => {
        controller.abort();
        throw new Error("late body rejection");
      },
    } as unknown as Response;

    await expect(
      requestXaiDeviceAuthorization(
        { fetchImpl: async () => response },
        controller.signal,
      ),
    ).rejects.toThrow("Login cancelled");
  });

  it("cancels a reader and removes composed abort listeners in the fetch-to-body race", async () => {
    const controller = new AbortController();
    let resolveFetch!: (response: Response) => void;
    let cancelled = false;
    let pulls = 0;
    let requestSignal!: AbortSignal;
    const response = {
      ok: true,
      status: 200,
      headers: new Headers({ "Content-Type": "application/json" }),
      body: {
        getReader() {
          return {
            read() {
              pulls++;
              return new Promise(() => {});
            },
            cancel() {
              cancelled = true;
              return Promise.resolve();
            },
          };
        },
      },
    } as unknown as Response;
    const pending = requestXaiDeviceAuthorization(
      {
        fetchImpl: (_url, init) => {
          requestSignal = init?.signal as AbortSignal;
          return new Promise<Response>((resolve) => {
            resolveFetch = resolve;
          });
        },
      },
      controller.signal,
    );
    resolveFetch(response);
    queueMicrotask(() => controller.abort());
    await expect(pending).rejects.toThrow("Login cancelled");
    await new Promise((resolve) => setImmediate(resolve));
    expect(cancelled).toBe(true);
    expect(pulls).toBeLessThanOrEqual(1);
    expect(getEventListeners(requestSignal, "abort")).toHaveLength(0);
  });

  it("clears its timeout after a successful request", async () => {
    let signal!: AbortSignal;
    await requestXaiDeviceAuthorization({
      requestTimeoutMs: 5,
      fetchImpl: async (_url, init) => {
        signal = init?.signal as AbortSignal;
        return jsonResponse(devicePayload());
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 15));
    expect(signal.aborted).toBe(false);
  });
});
