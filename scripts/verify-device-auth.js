#!/usr/bin/env node

const assert = require("assert");
const { getEventListeners } = require("events");
const path = require("path");
const { createJiti } = require("jiti");

const repoRoot = path.resolve(__dirname, "..");
const jiti = createJiti(__filename, { interopDefault: true });
const {
  pollXaiDeviceAuthorization,
  requestXaiDeviceAuthorization,
} = jiti(path.join(repoRoot, "extensions", "xai", "device-auth.ts"));
const { AuthStorage } = jiti("@earendil-works/pi-coding-agent");
const { registerOAuthProvider } = jiti(path.join(
  repoRoot,
  "node_modules",
  "@earendil-works",
  "pi-coding-agent",
  "node_modules",
  "@earendil-works",
  "pi-ai",
  "dist",
  "utils",
  "oauth",
  "index.js",
));
const {
  createXaiOAuth,
  detectXaiLoginContext,
  XAI_BROWSER_LOGIN_METHOD,
  XAI_DEVICE_LOGIN_METHOD,
} = jiti(path.join(repoRoot, "extensions", "xai", "oauth.ts"));
const {
  XAI_CLIENT_IDENTIFIER,
  XAI_CLIENT_VERSION,
  XAI_OAUTH_CLIENT_ID,
  XAI_OAUTH_DEVICE_GRANT_TYPE,
  XAI_OAUTH_DEVICE_URL,
  XAI_OAUTH_SCOPE,
  XAI_OAUTH_TOKEN_URL,
} = jiti(path.join(repoRoot, "extensions", "xai", "constants.ts"));

function jsonResponse(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function devicePayload(overrides = {}) {
  return {
    device_code: "opaque-device-code",
    user_code: "ABCD-EFGH",
    verification_uri: "https://auth.x.ai/device",
    expires_in: 600,
    interval: 5,
    ...overrides,
  };
}

function tokenPayload(overrides = {}) {
  return {
    access_token: "device-access-token",
    refresh_token: "device-refresh-token",
    expires_in: 3600,
    token_type: "Bearer",
    id_token: "unvalidated-device-id-token-must-not-be-retained",
    ...overrides,
  };
}

function makeClock(start = 1_000_000) {
  let current = start;
  const sleeps = [];
  return {
    now: () => current,
    sleeps,
    sleep: async (milliseconds, signal) => {
      if (signal?.aborted) throw new Error("cancelled");
      sleeps.push(milliseconds);
      current += milliseconds;
    },
  };
}

function deviceFixture(overrides = {}) {
  return {
    deviceCode: "opaque-device-code",
    userCode: "ABCD-EFGH",
    verificationUri: "https://auth.x.ai/device",
    intervalSeconds: 5,
    expiresInSeconds: 600,
    ...overrides,
  };
}

async function verifyDeviceInitiation() {
  const requests = [];
  const controller = new AbortController();
  const result = await requestXaiDeviceAuthorization({
    clientSurface: "ui",
    fetchImpl: async (url, init) => {
      requests.push({ url: String(url), init });
      return jsonResponse(devicePayload({
        verification_uri_complete: "https://accounts.x.ai/device?opaque=opaque-device-code",
        expires_in: 3600,
      }));
    },
  }, controller.signal);

  assert.deepStrictEqual(result, {
    deviceCode: "opaque-device-code",
    userCode: "ABCD-EFGH",
    verificationUri: "https://auth.x.ai/device",
    intervalSeconds: 5,
    expiresInSeconds: 900,
  });
  assert.equal(requests.length, 1);
  const request = requests[0];
  assert.equal(request.url, XAI_OAUTH_DEVICE_URL);
  assert.equal(request.init.method, "POST");
  assert.equal(request.init.redirect, "error");
  assert.ok(request.init.signal, "device initiation should receive a cancellation signal");
  assert.equal(request.init.headers.Accept, "application/json");
  assert.equal(request.init.headers["Content-Type"], "application/x-www-form-urlencoded");
  assert.equal(request.init.headers["X-Grok-Client-Version"], XAI_CLIENT_VERSION);
  assert.equal(request.init.headers["X-Grok-Client-Surface"], "ui");
  assert.deepStrictEqual(Object.fromEntries(new URLSearchParams(request.init.body)), {
    client_id: XAI_OAUTH_CLIENT_ID,
    scope: XAI_OAUTH_SCOPE,
    referrer: XAI_CLIENT_IDENTIFIER,
  });

  const invalidCases = [
    [devicePayload({ device_code: "" }), /invalid schema/],
    [devicePayload({ user_code: "BAD CODE" }), /invalid schema/],
    [devicePayload({ verification_uri: "https://evil.example/device" }), /invalid schema/],
    [devicePayload({ verification_uri: "javascript:alert(1)" }), /invalid schema/],
    [devicePayload({ verification_uri: "https://user:pass@auth.x.ai/device" }), /invalid schema/],
    [devicePayload({ verification_uri: "https://auth.x.ai/device#secret" }), /invalid schema/],
    [devicePayload({ verification_uri: "https://auth.x.ai/device?opaque=opaque-device-code" }), /invalid schema/],
    [devicePayload({ verification_uri: "https://auth.x.ai/device?opaque=opaque%2Ddevice%2Dcode" }), /invalid schema/],
    [devicePayload({ verification_uri: "https://auth.x.ai/device?opaque=opaque%252Ddevice%252Dcode" }), /invalid schema/],
    [devicePayload({ verification_uri: "https://auth.x.ai/opaque%2Ddevice%2Dcode" }), /invalid schema/],
    [devicePayload({ device_code: "abc=def", verification_uri: "https://auth.x.ai/device?abc=def" }), /invalid schema/],
    [devicePayload({ device_code: "abc&def", verification_uri: "https://auth.x.ai/device?abc&def" }), /invalid schema/],
    [devicePayload({ device_code: "abc?def", verification_uri: "https://auth.x.ai/device?abc?def" }), /invalid schema/],
    [devicePayload({ device_code: "auth.x.ai" }), /invalid schema/],
    [devicePayload({ expires_in: 0 }), /invalid schema/],
    [devicePayload({ interval: 0 }), /invalid schema/],
    [devicePayload({ interval: "5" }), /invalid schema/],
  ];
  for (const [body, pattern] of invalidCases) {
    await assert.rejects(
      requestXaiDeviceAuthorization({ fetchImpl: async () => jsonResponse(body) }),
      pattern,
    );
  }

  await assert.rejects(
    requestXaiDeviceAuthorization({ fetchImpl: async () => new Response("not json") }),
    /did not return JSON/,
  );
  await assert.rejects(
    requestXaiDeviceAuthorization({ fetchImpl: async () => new Response("{", { headers: { "Content-Type": "application/json" } }) }),
    /invalid JSON/,
  );
  await assert.rejects(
    requestXaiDeviceAuthorization({
      fetchImpl: async () => jsonResponse({}, 200, { "Content-Length": "70000" }),
    }),
    /too large/,
  );
  let streamPulls = 0;
  let streamCancelled = false;
  const oversizedStream = new ReadableStream({
    pull(controller) {
      streamPulls += 1;
      controller.enqueue(new Uint8Array(1024));
      if (streamPulls >= 100) controller.close();
    },
    cancel() {
      streamCancelled = true;
    },
  });
  await assert.rejects(
    requestXaiDeviceAuthorization({
      fetchImpl: async () => new Response(oversizedStream, { headers: { "Content-Type": "application/json" } }),
    }),
    /too large/,
  );
  assert.ok(streamPulls <= 66, "chunked device responses must stop at the 64 KiB bound");
  assert.equal(streamCancelled, true, "oversized chunked device responses must cancel their reader");
  await assert.rejects(
    requestXaiDeviceAuthorization({ fetchImpl: async () => jsonResponse({}, 404) }),
    /not available.*browser login/,
  );
  await assert.rejects(
    requestXaiDeviceAuthorization({ fetchImpl: async () => jsonResponse({}, 503) }),
    /status 503/,
  );
  await assert.rejects(
    requestXaiDeviceAuthorization({ fetchImpl: async () => { throw new Error("secret network detail"); } }),
    (error) => {
      assert.equal(error.message, "xAI device authorization request failed");
      assert.doesNotMatch(error.message, /secret network detail/);
      return true;
    },
  );
}

async function verifyPollingCadence() {
  const clock = makeClock();
  const requests = [];
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
        requests.push({ at: clock.now(), url: String(url), init });
        return responses.shift();
      },
    },
  );
  assert.deepStrictEqual(clock.sleeps, [2000, 2000, 7000, 12000, 12000]);
  assert.deepStrictEqual(
    requests.map((request) => request.at),
    [1_002_000, 1_004_000, 1_011_000, 1_023_000, 1_035_000],
    "each slow_down response must cumulatively lengthen the next cadence",
  );
  assert.equal(requests.every((request) => request.url === XAI_OAUTH_TOKEN_URL), true);
  for (const request of requests) {
    assert.equal(request.init.method, "POST");
    assert.equal(request.init.redirect, "error");
    assert.deepStrictEqual(Object.fromEntries(new URLSearchParams(request.init.body)), {
      grant_type: XAI_OAUTH_DEVICE_GRANT_TYPE,
      device_code: "opaque-device-code",
      client_id: XAI_OAUTH_CLIENT_ID,
    });
  }
  assert.deepStrictEqual(result, {
    access_token: "device-access-token",
    refresh_token: "device-refresh-token",
    expires_in: 3600,
    token_type: "Bearer",
  });
  assert.equal(Object.hasOwn(result, "id_token"), false, "device ID tokens must not be retained");

  const defaultClock = makeClock();
  let firstRequestAt;
  await pollXaiDeviceAuthorization(
    deviceFixture({ intervalSeconds: undefined }),
    {
      now: defaultClock.now,
      sleep: defaultClock.sleep,
      fetchImpl: async () => {
        firstRequestAt = defaultClock.now();
        return jsonResponse(tokenPayload());
      },
    },
  );
  assert.equal(firstRequestAt, 1_005_000, "missing interval must wait the RFC default before the first request");

  const expiryClock = makeClock();
  let expiryPolls = 0;
  await assert.rejects(
    pollXaiDeviceAuthorization(
      deviceFixture({ intervalSeconds: 2, expiresInSeconds: 3 }),
      {
        now: expiryClock.now,
        sleep: expiryClock.sleep,
        fetchImpl: async () => {
          expiryPolls += 1;
          return jsonResponse({ error: "authorization_pending" }, 400);
        },
      },
    ),
    /expired/,
  );
  assert.deepStrictEqual(expiryClock.sleeps, [2000, 1000]);
  assert.equal(expiryPolls, 1, "local expiry must stop without a tight or late poll");
}

async function verifyPollingFailuresAndRedaction() {
  const cases = [
    [jsonResponse({ error: "access_denied", error_description: "DENIAL_SECRET" }, 400), /was denied/],
    [jsonResponse({ error: "authorization_denied" }, 400), /was denied/],
    [jsonResponse({ error: "expired_token" }, 400), /expired/],
    [jsonResponse({ error: "unknown_error", error_description: "UNKNOWN_SECRET" }, 400), /authorization failed/],
    [jsonResponse({}, 400), /invalid schema/],
    [jsonResponse({}, 429), /status 429/],
    [jsonResponse({}, 503), /status 503/],
    [new Response("bad gateway", { status: 400 }), /status 400/],
    [jsonResponse({ refresh_token: "refresh" }), /access token/],
    [jsonResponse({ access_token: "access" }), /refresh token/],
    [jsonResponse(tokenPayload({ expires_in: "3600" })), /invalid schema/],
  ];
  for (const [response, expected] of cases) {
    const clock = makeClock();
    await assert.rejects(
      pollXaiDeviceAuthorization(
        deviceFixture({ intervalSeconds: 1 }),
        { now: clock.now, sleep: clock.sleep, fetchImpl: async () => response },
      ),
      (error) => {
        assert.match(error.message, expected);
        assert.doesNotMatch(error.message, /DENIAL_SECRET|UNKNOWN_SECRET|device-access-token|device-refresh-token|opaque-device-code/);
        return true;
      },
    );
  }

  const malformedSlowDownClock = makeClock();
  await assert.rejects(
    pollXaiDeviceAuthorization(
      deviceFixture({ intervalSeconds: 1 }),
      {
        now: malformedSlowDownClock.now,
        sleep: malformedSlowDownClock.sleep,
        fetchImpl: async () => jsonResponse({ error: "slow_down", interval: "10" }, 400),
      },
    ),
    /invalid schema/,
  );

  let tokenPulls = 0;
  let tokenStreamCancelled = false;
  const oversizedTokenStream = new ReadableStream({
    pull(controller) {
      tokenPulls += 1;
      controller.enqueue(new Uint8Array(1024));
      if (tokenPulls >= 100) controller.close();
    },
    cancel() {
      tokenStreamCancelled = true;
    },
  });
  const oversizedTokenClock = makeClock();
  await assert.rejects(
    pollXaiDeviceAuthorization(
      deviceFixture({ intervalSeconds: 1 }),
      {
        now: oversizedTokenClock.now,
        sleep: oversizedTokenClock.sleep,
        fetchImpl: async () => new Response(oversizedTokenStream, { headers: { "Content-Type": "application/json" } }),
      },
    ),
    /too large/,
  );
  assert.ok(tokenPulls <= 66, "chunked token responses must stop at the 64 KiB bound");
  assert.equal(tokenStreamCancelled, true, "oversized chunked token responses must cancel their reader");
}

async function verifyCancellation() {
  const preAborted = new AbortController();
  preAborted.abort();
  let preAbortRequests = 0;
  await assert.rejects(
    requestXaiDeviceAuthorization({ fetchImpl: async () => { preAbortRequests += 1; return jsonResponse(devicePayload()); } }, preAborted.signal),
    (error) => {
      assert.equal(error.message, "Login cancelled");
      return true;
    },
  );
  assert.equal(preAbortRequests, 0);

  const initiationAbort = new AbortController();
  let initiationSignal;
  const initiation = requestXaiDeviceAuthorization({
    fetchImpl: async (_url, init) => {
      initiationSignal = init.signal;
      queueMicrotask(() => initiationAbort.abort());
      return new Promise(() => {});
    },
  }, initiationAbort.signal);
  await assert.rejects(initiation, (error) => {
    assert.equal(error.message, "Login cancelled");
    return true;
  });
  assert.equal(initiationSignal.aborted, true, "in-flight initiation must receive cancellation");

  const waitAbort = new AbortController();
  let pollsAfterWaitAbort = 0;
  await assert.rejects(
    pollXaiDeviceAuthorization(
      deviceFixture(),
      {
        now: () => 0,
        sleep: async (_milliseconds, signal) => new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(new Error("aborted sleep")), { once: true });
          waitAbort.abort();
        }),
        fetchImpl: async () => { pollsAfterWaitAbort += 1; return jsonResponse(tokenPayload()); },
      },
      waitAbort.signal,
    ),
    /cancelled/,
  );
  assert.equal(pollsAfterWaitAbort, 0, "cancellation during the initial wait must prevent polling");

  const fetchAbort = new AbortController();
  const clock = makeClock();
  let pollSignal;
  const polling = pollXaiDeviceAuthorization(
    deviceFixture({ intervalSeconds: 1 }),
    {
      now: clock.now,
      sleep: clock.sleep,
      fetchImpl: async (_url, init) => {
        pollSignal = init.signal;
        queueMicrotask(() => fetchAbort.abort());
        return new Promise(() => {});
      },
    },
    fetchAbort.signal,
  );
  await assert.rejects(polling, (error) => {
    assert.equal(error.message, "Login cancelled");
    return true;
  });
  assert.equal(pollSignal.aborted, true, "in-flight polling must receive cancellation");

  const lateClock = makeClock();
  await assert.rejects(
    pollXaiDeviceAuthorization(
      deviceFixture({ intervalSeconds: 1, expiresInSeconds: 2 }),
      {
        now: lateClock.now,
        sleep: lateClock.sleep,
        fetchImpl: async () => {
          await lateClock.sleep(2000);
          return jsonResponse(tokenPayload());
        },
      },
    ),
    /expired/,
    "a token response arriving after the bounded deadline must be ignored",
  );
}

async function verifyTimeoutsAndAbortRaces() {
  let timedOutFetchSignal;
  await assert.rejects(
    requestXaiDeviceAuthorization({
      requestTimeoutMs: 5,
      fetchImpl: async (_url, init) => {
        timedOutFetchSignal = init.signal;
        return new Promise(() => {});
      },
    }),
    /request timed out/,
  );
  assert.equal(timedOutFetchSignal.aborted, true, "a hung initiation request must be aborted");

  let bodyRequestSignal;
  const hangingBodyResponse = {
    ok: true,
    status: 200,
    headers: new Headers({ "Content-Type": "application/json" }),
    body: null,
    text: async () => new Promise(() => {}),
  };
  await assert.rejects(
    requestXaiDeviceAuthorization({
      requestTimeoutMs: 5,
      fetchImpl: async (_url, init) => {
        bodyRequestSignal = init.signal;
        return hangingBodyResponse;
      },
    }),
    /request timed out/,
  );
  assert.equal(bodyRequestSignal.aborted, true, "a hung initiation body must be aborted");

  const synchronousFetchAbort = new AbortController();
  await assert.rejects(
    requestXaiDeviceAuthorization({
      fetchImpl: async () => {
        synchronousFetchAbort.abort();
        throw new Error("late fetch rejection must be observed");
      },
    }, synchronousFetchAbort.signal),
    (error) => {
      assert.equal(error.message, "Login cancelled");
      return true;
    },
  );

  const fetchToBodyAbort = new AbortController();
  let resolveFetch;
  let hangingStreamCancelled = false;
  let hangingStreamPulls = 0;
  const raceBodyResponse = {
    ok: true,
    status: 200,
    headers: new Headers({ "Content-Type": "application/json" }),
    body: {
      getReader() {
        return {
          read() {
            hangingStreamPulls += 1;
            return new Promise(() => {});
          },
          cancel() {
            hangingStreamCancelled = true;
            return Promise.resolve();
          },
        };
      },
    },
  };
  let fetchToBodyRequestSignal;
  const fetchToBodyRace = requestXaiDeviceAuthorization({
    fetchImpl: (_url, init) => {
      fetchToBodyRequestSignal = init.signal;
      return new Promise((resolve) => { resolveFetch = resolve; });
    },
  }, fetchToBodyAbort.signal);
  resolveFetch(raceBodyResponse);
  queueMicrotask(() => fetchToBodyAbort.abort());
  await assert.rejects(fetchToBodyRace, (error) => {
    assert.equal(error.message, "Login cancelled");
    return true;
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(hangingStreamCancelled, true, "fetch-to-body cancellation must cancel an already-started reader");
  assert.ok(hangingStreamPulls <= 1, "fetch-to-body cancellation must not keep pulling data");
  assert.equal(
    getEventListeners(fetchToBodyRequestSignal, "abort").length,
    0,
    "fetch-to-body cancellation must remove composed-signal listeners",
  );

  const bodyAbort = new AbortController();
  const rejectingBodyResponse = {
    ok: true,
    status: 200,
    headers: new Headers({ "Content-Type": "application/json" }),
    body: null,
    text: async () => {
      bodyAbort.abort();
      throw new Error("late body rejection must be observed");
    },
  };
  await assert.rejects(
    requestXaiDeviceAuthorization({ fetchImpl: async () => rejectingBodyResponse }, bodyAbort.signal),
    (error) => {
      assert.equal(error.message, "Login cancelled");
      return true;
    },
  );

  let settledSignal;
  await requestXaiDeviceAuthorization({
    requestTimeoutMs: 5,
    fetchImpl: async (_url, init) => {
      settledSignal = init.signal;
      return jsonResponse(devicePayload());
    },
  });
  await new Promise((resolve) => setTimeout(resolve, 15));
  assert.equal(settledSignal.aborted, false, "successful requests must clear their timeout timer");
}

async function selectorOptionsFor(environment) {
  let prompt;
  const oauth = createXaiOAuth({
    getExistingCredentials: () => null,
    loginEnvironment: environment,
  });
  await assert.rejects(
    oauth.login({
      onPrompt: async () => "n",
      onAuth: () => { throw new Error("browser must not open after selector cancellation"); },
      onDeviceCode: () => {},
      onSelect: async (value) => { prompt = value; return undefined; },
    }),
    /Login cancelled/,
  );
  return prompt;
}

async function verifyMethodSelectionAndContexts() {
  const contexts = [
    [{ env: {}, stdinIsTTY: true, stdoutIsTTY: true }, "desktop", /remote\/headless/],
    [{ env: { WSL_DISTRO_NAME: "Ubuntu" }, stdinIsTTY: true, stdoutIsTTY: true }, "wsl", /recommended for this WSL session/],
    [{ env: { SSH_CONNECTION: "test" }, stdinIsTTY: true, stdoutIsTTY: true }, "ssh", /recommended for this SSH session/],
    [{ env: { container: "docker" }, stdinIsTTY: true, stdoutIsTTY: true }, "container", /recommended for this container/],
    [{ env: {}, stdinIsTTY: false, stdoutIsTTY: false }, "headless", /recommended for this headless session/],
  ];
  for (const [environment, expectedContext, deviceLabel] of contexts) {
    assert.equal(detectXaiLoginContext(environment), expectedContext);
    const prompt = await selectorOptionsFor(environment);
    assert.equal(prompt.message, "Select xAI login method:");
    assert.deepStrictEqual(prompt.options.map((option) => option.id), [XAI_BROWSER_LOGIN_METHOD, XAI_DEVICE_LOGIN_METHOD]);
    assert.equal(prompt.options[0].label, "Browser login (default)");
    assert.match(prompt.options[1].label, deviceLabel);
    assert.notEqual(prompt.options[0].label, prompt.options[1].label);
  }

  const oauth = createXaiOAuth({ getExistingCredentials: () => null });
  await assert.rejects(
    oauth.login({
      onPrompt: async () => "n",
      onAuth: () => {},
      onDeviceCode: () => {},
      onSelect: async () => "unexpected",
    }),
    /Unsupported xAI login method/,
  );
}

async function verifyDeviceLoginIntegration() {
  const clock = makeClock();
  const requests = [];
  const progress = [];
  const deviceUi = [];
  const completed = [];
  const oauth = createXaiOAuth({
    getExistingCredentials: () => null,
    loginEnvironment: { env: { SSH_CONNECTION: "test" }, stdinIsTTY: true, stdoutIsTTY: true },
    deviceAuth: {
      now: clock.now,
      sleep: clock.sleep,
      fetchImpl: async (url, init) => {
        requests.push({ url: String(url), init });
        return String(url) === XAI_OAUTH_DEVICE_URL
          ? jsonResponse(devicePayload({ interval: 2 }))
          : jsonResponse(tokenPayload());
      },
    },
    onLoginCredentials: async (credentials, callbacks) => {
      completed.push(credentials);
      assert.equal(callbacks.signal?.aborted, false);
    },
  });
  const controller = new AbortController();
  const credentials = await oauth.login({
    onPrompt: async () => { throw new Error("device login must not prompt"); },
    onAuth: () => { throw new Error("device login must not open browser auth"); },
    onManualCodeInput: async () => { throw new Error("device login must not request manual callback input"); },
    onSelect: async (prompt) => {
      assert.match(prompt.options[1].label, /recommended for this SSH session/);
      return XAI_DEVICE_LOGIN_METHOD;
    },
    onDeviceCode: (info) => deviceUi.push(info),
    onProgress: (message) => progress.push(message),
    signal: controller.signal,
  });

  assert.equal(requests.length, 2);
  assert.deepStrictEqual(clock.sleeps, [2000], "device login must wait before its first token request");
  assert.deepStrictEqual(deviceUi, [{
    userCode: "ABCD-EFGH",
    verificationUri: "https://auth.x.ai/device",
    intervalSeconds: 2,
    expiresInSeconds: 600,
  }]);
  assert.equal(credentials.access, "device-access-token");
  assert.equal(credentials.refresh, "device-refresh-token");
  assert.equal(credentials.tokenEndpoint, XAI_OAUTH_TOKEN_URL);
  assert.equal(Object.hasOwn(credentials, "idToken"), false);
  assert.equal(completed.length, 1, "device success must use the common post-login/catalog hook");
  assert.doesNotMatch(JSON.stringify(progress), /opaque-device-code|device-access-token|device-refresh-token|unvalidated-device-id-token/);

  const handoffAbort = new AbortController();
  const handoffClock = makeClock();
  const cancelledHandoff = createXaiOAuth({
    getExistingCredentials: () => null,
    deviceAuth: {
      now: handoffClock.now,
      sleep: handoffClock.sleep,
      fetchImpl: async (url) => String(url) === XAI_OAUTH_DEVICE_URL
        ? jsonResponse(devicePayload({ interval: 1 }))
        : jsonResponse(tokenPayload()),
    },
    onLoginCredentials: async () => handoffAbort.abort(),
  });
  await assert.rejects(
    cancelledHandoff.login({
      onPrompt: async () => "n",
      onAuth: () => {},
      onDeviceCode: () => {},
      onSelect: async () => XAI_DEVICE_LOGIN_METHOD,
      signal: handoffAbort.signal,
    }),
    (error) => {
      assert.equal(error.message, "Login cancelled");
      return true;
    },
    "cancellation during the post-login catalog handoff must return no credentials",
  );
}

async function verifyPiAuthStoragePersistence() {
  const providerId = "xai-device-auth-test";
  const cancellation = new AbortController();
  const cancelClock = makeClock();
  const cancelOauth = createXaiOAuth({
    getExistingCredentials: () => null,
    deviceAuth: {
      now: cancelClock.now,
      sleep: cancelClock.sleep,
      fetchImpl: async (url) => String(url) === XAI_OAUTH_DEVICE_URL
        ? jsonResponse(devicePayload({ interval: 1 }))
        : jsonResponse(tokenPayload()),
    },
  });
  registerOAuthProvider({ id: providerId, ...cancelOauth });
  const authStorage = AuthStorage.inMemory({
    [providerId]: {
      type: "oauth",
      access: "existing-access",
      refresh: "existing-refresh",
      expires: Date.now() + 60_000,
    },
  });
  await assert.rejects(
    authStorage.login(providerId, {
      onPrompt: async () => "n",
      onAuth: () => {},
      onSelect: async () => XAI_DEVICE_LOGIN_METHOD,
      onDeviceCode: () => cancellation.abort(),
      signal: cancellation.signal,
    }),
    (error) => {
      assert.equal(error.message, "Login cancelled");
      return true;
    },
  );
  assert.equal(authStorage.get(providerId).access, "existing-access");
  assert.equal(authStorage.get(providerId).refresh, "existing-refresh");

  const successClock = makeClock();
  const successOauth = createXaiOAuth({
    getExistingCredentials: () => null,
    deviceAuth: {
      now: successClock.now,
      sleep: successClock.sleep,
      fetchImpl: async (url) => String(url) === XAI_OAUTH_DEVICE_URL
        ? jsonResponse(devicePayload({ interval: 1 }))
        : jsonResponse(tokenPayload()),
    },
  });
  registerOAuthProvider({ id: providerId, ...successOauth });
  await authStorage.login(providerId, {
    onPrompt: async () => "n",
    onAuth: () => {},
    onSelect: async () => XAI_DEVICE_LOGIN_METHOD,
    onDeviceCode: () => {},
  });
  assert.equal(authStorage.get(providerId).access, "device-access-token");
  assert.equal(authStorage.get(providerId).refresh, "device-refresh-token");
}

async function verifyRefreshRotationAndPreservation() {
  const originalFetch = global.fetch;
  const responses = [
    jsonResponse({ access_token: "rotated-access", refresh_token: "rotated-refresh", expires_in: 3600 }),
    jsonResponse({ access_token: "preserved-access", expires_in: 3600 }),
  ];
  const bodies = [];
  global.fetch = async (url, init) => {
    assert.equal(String(url), XAI_OAUTH_TOKEN_URL);
    bodies.push(Object.fromEntries(new URLSearchParams(init.body)));
    return responses.shift();
  };
  try {
    const oauth = createXaiOAuth({ getExistingCredentials: () => null });
    const base = {
      access: "old-access",
      refresh: "old-refresh",
      expires: 1,
      tokenEndpoint: XAI_OAUTH_TOKEN_URL,
    };
    const rotated = await oauth.refreshToken(base);
    assert.equal(rotated.refresh, "rotated-refresh");
    const preserved = await oauth.refreshToken(base);
    assert.equal(preserved.refresh, "old-refresh");
    assert.equal(bodies.every((body) => !Object.hasOwn(body, "scope")), true);
  } finally {
    global.fetch = originalFetch;
  }
}

async function main() {
  await verifyDeviceInitiation();
  await verifyPollingCadence();
  await verifyPollingFailuresAndRedaction();
  await verifyCancellation();
  await verifyTimeoutsAndAbortRaces();
  await verifyMethodSelectionAndContexts();
  await verifyDeviceLoginIntegration();
  await verifyPiAuthStoragePersistence();
  await verifyRefreshRotationAndPreservation();
  console.log("verify-device-auth: ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
