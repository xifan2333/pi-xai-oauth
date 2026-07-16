#!/usr/bin/env node

const assert = require("assert");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { createJiti } = require("jiti");

const repoRoot = path.resolve(__dirname, "..");
const jiti = createJiti(__filename, { interopDefault: true });
const {
  XaiCatalogCancelledError,
  XaiCatalogValidationError,
  fetchXaiModelCatalog,
  normalizeXaiCatalogPayload,
  selectXaiModelCatalog,
} = jiti(path.join(repoRoot, "extensions", "xai", "catalog.ts"));
const {
  XAI_CLI_MODELS_URL,
  XAI_MODEL_CATALOG_CACHE_SCHEMA,
  XAI_MODEL_CATALOG_FRESH_TTL_MS,
  XAI_MODEL_CATALOG_MAX_BYTES,
  XAI_MODEL_CATALOG_MAX_STALE_MS,
} = jiti(path.join(repoRoot, "extensions", "xai", "constants.ts"));

const fixtureDir = path.join(repoRoot, "scripts", "fixtures", "models-v2");
const TOKEN_SENTINEL = "OAUTH_TOKEN_MUST_NEVER_REACH_CACHE";

async function fixture(name) {
  return JSON.parse(await fs.readFile(path.join(fixtureDir, name), "utf8"));
}

function jsonResponse(body, status = 200, headers = {}) {
  const text = JSON.stringify(body);
  return new Response(text, {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

async function writeCache(cachePath, fetchedAt, models) {
  await fs.mkdir(path.dirname(cachePath), { recursive: true });
  await fs.writeFile(cachePath, JSON.stringify({
    schemaVersion: XAI_MODEL_CATALOG_CACHE_SCHEMA,
    fetchedAt,
    models,
  }));
}

async function main() {
  const additionsFixture = await fixture("additions.json");
  const removalsFixture = await fixture("removals.json");
  const malformedFixture = await fixture("malformed.json");
  const apiKeyOnlyFixture = await fixture("api-key-only.json");

  const additions = normalizeXaiCatalogPayload(additionsFixture);
  assert.deepEqual(additions.map((model) => model.id), [
    "grok-4.5",
    "grok-composer-2.5-fast",
    "grok-new-oauth-model",
  ]);
  assert.equal(additions[0].contextWindow, 500_000);
  assert.equal(additions[0].maxTokens, 131_072, "known output metadata should fill an omitted remote limit");
  assert.equal(additions[0].thinkingLevelMap.off, null);
  assert.equal(additions[0].thinkingLevelMap.minimal, "low", "Grok 4.5 minimal compatibility should remain low");
  assert.equal(additions[2].thinkingLevelMap.xhigh, "xhigh");
  assert.equal(additions[2].thinkingLevelMap.medium, "medium");
  assert.equal(additions[2].input.join(","), "text", "unknown models should use conservative text-only input");
  assert.deepEqual(additions[2].cost, { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });
  const noneReasoning = normalizeXaiCatalogPayload({ data: [{
    model: "none-capable",
    api_backend: "responses",
    context_window: 100_000,
    supports_reasoning_effort: true,
    reasoning_efforts: ["none", "low"],
  }] })[0];
  assert.equal(noneReasoning.thinkingLevelMap.off, "none", "official none effort should map to pi off");
  const implicitReasoningLevels = normalizeXaiCatalogPayload({ data: [{
    model: "implicit-levels",
    api_backend: "responses",
    context_window: 100_000,
    supports_reasoning_effort: true,
  }] })[0];
  assert.equal(implicitReasoningLevels.thinkingLevelMap.low, "low");
  assert.equal(implicitReasoningLevels.thinkingLevelMap.medium, "medium");
  assert.equal(implicitReasoningLevels.thinkingLevelMap.high, "high");
  for (const reasoningEfforts of [[], "malformed"]) {
    const normalized = normalizeXaiCatalogPayload({ data: [{
      model: "empty-levels",
      api_backend: "responses",
      context_window: 100_000,
      supports_reasoning_effort: true,
      reasoning_efforts: reasoningEfforts,
    }] })[0];
    assert.equal(normalized.thinkingLevelMap.low, "low", "empty/malformed level lists should use capability defaults");
    assert.equal(normalized.thinkingLevelMap.high, "high");
  }
  const clampedKnownOutput = normalizeXaiCatalogPayload({ data: [{
    model: "grok-4.5",
    api_backend: "responses",
    context_window: 100_000,
  }] })[0];
  assert.equal(clampedKnownOutput.maxTokens, 100_000, "known output fallback must not exceed remote context");

  const removals = normalizeXaiCatalogPayload(removalsFixture);
  assert.deepEqual(removals.map((model) => model.id), ["grok-composer-2.5-fast"]);
  assert.deepEqual(normalizeXaiCatalogPayload({ data: [] }), [], "an authenticated empty catalog is an exact empty entitlement set");

  const malformed = normalizeXaiCatalogPayload(malformedFixture);
  assert.deepEqual(malformed.map((model) => model.id), ["meta-valid-model"]);
  assert.throws(
    () => normalizeXaiCatalogPayload({ data: [{ model: "bad", context_window: 1000 }] }),
    XaiCatalogValidationError,
    "an all-malformed non-empty catalog should not replace last-known-good data",
  );
  assert.throws(() => normalizeXaiCatalogPayload({ models: [] }), XaiCatalogValidationError);

  const apiFiltered = normalizeXaiCatalogPayload(apiKeyOnlyFixture);
  assert.deepEqual(apiFiltered.map((model) => model.id), ["oauth-safe-model"]);
  assert.equal(apiFiltered[0].name, "OAuth Safe Model", "first duplicate should win deterministically");
  assert.doesNotMatch(JSON.stringify(apiFiltered), /MUST_NOT_REACH_CACHE|XAI_API_KEY/);

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "pi-xai-catalog-test-"));
  try {
    const now = 2_000_000_000_000;
    const freshPath = path.join(tempDir, "fresh", "models-v2.json");
    await writeCache(freshPath, now - XAI_MODEL_CATALOG_FRESH_TTL_MS + 1, additions);
    let freshFetches = 0;
    const fresh = await selectXaiModelCatalog({
      credential: { access: TOKEN_SENTINEL },
      cachePath: freshPath,
      now,
      fetchImpl: async () => { freshFetches++; throw new Error("must not fetch"); },
    });
    assert.equal(fresh.source, "fresh-cache");
    assert.equal(freshFetches, 0, "fresh cache must avoid startup network delay");
    await fs.chmod(freshPath, 0o644);
    const tightened = await selectXaiModelCatalog({
      credential: { access: TOKEN_SENTINEL },
      cachePath: freshPath,
      now,
      fetchImpl: async () => { throw new Error("must not fetch"); },
    });
    assert.equal(tightened.source, "fresh-cache");
    assert.equal((await fs.stat(freshPath)).mode & 0o777, 0o600, "preexisting permissive cache should be tightened");
    const noCredentialFresh = await selectXaiModelCatalog({ cachePath: freshPath, now });
    assert.equal(noCredentialFresh.source, "curated-fallback", "logout must not advertise a previous account's fresh cache");

    const stalePath = path.join(tempDir, "stale", "models-v2.json");
    await writeCache(stalePath, now - XAI_MODEL_CATALOG_FRESH_TTL_MS, additions);
    let capturedRequest;
    const refreshed = await selectXaiModelCatalog({
      credential: { access: TOKEN_SENTINEL },
      cachePath: stalePath,
      now,
      fetchImpl: async (url, init) => {
        capturedRequest = { url: String(url), init };
        return jsonResponse(removalsFixture);
      },
    });
    assert.equal(refreshed.source, "remote");
    assert.deepEqual(refreshed.models.map((model) => model.id), ["grok-composer-2.5-fast"], "successful refresh must replace, not merge");
    assert.equal(capturedRequest.url, XAI_CLI_MODELS_URL);
    assert.equal(capturedRequest.init.method, "GET");
    assert.equal(capturedRequest.init.redirect, "error");
    assert.equal(capturedRequest.init.headers["X-XAI-Token-Auth"], "xai-grok-cli");
    assert.equal(capturedRequest.init.headers.Authorization, `Bearer ${TOKEN_SENTINEL}`);
    const refreshedCache = await fs.readFile(stalePath, "utf8");
    assert.doesNotMatch(refreshedCache, new RegExp(TOKEN_SENTINEL));
    assert.deepEqual(JSON.parse(refreshedCache).models.map((model) => model.id), ["grok-composer-2.5-fast"]);
    assert.equal((await fs.stat(stalePath)).mode & 0o777, 0o600, "cache should be user-readable only");

    await writeCache(stalePath, now - XAI_MODEL_CATALOG_FRESH_TTL_MS, additions);
    await writeCache(freshPath, now - 1, additions);
    let changedCredentialFetches = 0;
    const changedCredential = await selectXaiModelCatalog({
      credential: { access: TOKEN_SENTINEL },
      credentialChangedAt: now,
      cachePath: freshPath,
      now,
      fetchImpl: async () => {
        changedCredentialFetches++;
        return jsonResponse(removalsFixture);
      },
    });
    assert.equal(changedCredential.source, "remote", "credential-store changes newer than cache must force discovery");
    assert.equal(changedCredentialFetches, 1);

    const staleNetwork = await selectXaiModelCatalog({
      credential: { access: TOKEN_SENTINEL },
      cachePath: stalePath,
      now,
      fetchImpl: async () => { throw new Error("offline"); },
    });
    assert.equal(staleNetwork.source, "stale-cache");
    assert.deepEqual(staleNetwork.models.map((model) => model.id), additions.map((model) => model.id));

    const oversized = await selectXaiModelCatalog({
      credential: { access: TOKEN_SENTINEL },
      cachePath: stalePath,
      now,
      fetchImpl: async () => jsonResponse({}, 200, { "Content-Length": String(XAI_MODEL_CATALOG_MAX_BYTES + 1) }),
    });
    assert.equal(oversized.source, "stale-cache", "oversized successful response should preserve last-known-good data");

    const invalidSuccess = await selectXaiModelCatalog({
      credential: { access: TOKEN_SENTINEL },
      cachePath: stalePath,
      now,
      fetchImpl: async () => jsonResponse({ data: [{ model: "broken" }] }),
    });
    assert.equal(invalidSuccess.source, "stale-cache", "malformed 2xx should preserve last-known-good data");

    const cancelledController = new AbortController();
    const cacheBeforeCancellation = await fs.readFile(stalePath, "utf8");
    let markCancelledFetchStarted;
    let resolveCancelledFetch;
    const cancelledFetchStarted = new Promise((resolve) => { markCancelledFetchStarted = resolve; });
    const cancelledSelection = selectXaiModelCatalog({
      credential: { access: TOKEN_SENTINEL },
      cachePath: stalePath,
      now,
      forceRefresh: true,
      signal: cancelledController.signal,
      fetchImpl: async () => new Promise((resolve) => {
        resolveCancelledFetch = resolve;
        markCancelledFetchStarted();
      }),
    });
    await cancelledFetchStarted;
    cancelledController.abort();
    resolveCancelledFetch(jsonResponse(removalsFixture));
    await assert.rejects(cancelledSelection, XaiCatalogCancelledError);
    assert.equal(await fs.readFile(stalePath, "utf8"), cacheBeforeCancellation, "caller cancellation must not mutate cache state");

    let commitChecks = 0;
    const cancelledDuringCommit = selectXaiModelCatalog({
      credential: { access: TOKEN_SENTINEL },
      cachePath: stalePath,
      now,
      commitAllowed: () => ++commitChecks < 4,
      fetchImpl: async () => jsonResponse(removalsFixture),
    });
    await assert.rejects(cancelledDuringCommit, XaiCatalogCancelledError);
    assert.deepEqual(
      JSON.parse(await fs.readFile(stalePath, "utf8")).models.map((model) => model.id),
      additions.map((model) => model.id),
      "cancellation after queued commit must conditionally restore the previous cache",
    );

    const authFailure = await selectXaiModelCatalog({
      credential: { access: TOKEN_SENTINEL },
      cachePath: stalePath,
      now,
      fetchImpl: async () => jsonResponse({}, 401),
    });
    assert.equal(authFailure.source, "curated-fallback");
    assert.deepEqual(authFailure.models.map((model) => model.id), ["grok-4.5"]);
    assert.equal(JSON.parse(await fs.readFile(stalePath, "utf8")).invalidated, true, "auth failure must invalidate cached entitlements durably");

    await writeCache(stalePath, now - XAI_MODEL_CATALOG_FRESH_TTL_MS, additions);
    const forcedTransient = await selectXaiModelCatalog({
      credential: { access: TOKEN_SENTINEL },
      cachePath: stalePath,
      now,
      forceRefresh: true,
      fetchImpl: async () => { throw new Error("new account offline"); },
    });
    assert.equal(forcedTransient.source, "curated-fallback", "post-login refresh must not reuse another account's stale cache");
    assert.equal(forcedTransient.needsAuthenticatedRefresh, true, "transient forced failure should remain retryable");
    assert.equal(JSON.parse(await fs.readFile(stalePath, "utf8")).invalidated, true, "failed forced refresh must invalidate old account cache");

    const noCacheTransient = await selectXaiModelCatalog({
      credential: { access: TOKEN_SENTINEL },
      cachePath: path.join(tempDir, "transient-missing", "models-v2.json"),
      now,
      fetchImpl: async () => { throw new Error("offline"); },
    });
    assert.equal(noCacheTransient.source, "curated-fallback");
    assert.equal(noCacheTransient.needsAuthenticatedRefresh, true);

    const tooOldPath = path.join(tempDir, "too-old", "models-v2.json");
    await writeCache(tooOldPath, now - XAI_MODEL_CATALOG_MAX_STALE_MS - 1, additions);
    const tooOld = await selectXaiModelCatalog({
      credential: { access: TOKEN_SENTINEL },
      cachePath: tooOldPath,
      now,
      fetchImpl: async () => { throw new Error("offline"); },
    });
    assert.equal(tooOld.source, "curated-fallback");

    const noCredentials = await selectXaiModelCatalog({
      cachePath: path.join(tempDir, "missing", "models-v2.json"),
      now,
      refreshWhenCredentialsAvailable: true,
    });
    assert.equal(noCredentials.source, "curated-fallback");
    assert.equal(noCredentials.needsAuthenticatedRefresh, true);

    const secretFilterPath = path.join(tempDir, "secret-filter", "models-v2.json");
    const secretFiltered = await selectXaiModelCatalog({
      credential: { access: TOKEN_SENTINEL },
      cachePath: secretFilterPath,
      now,
      fetchImpl: async () => jsonResponse(apiKeyOnlyFixture),
    });
    assert.equal(secretFiltered.source, "remote");
    assert.deepEqual(secretFiltered.models.map((model) => model.id), ["oauth-safe-model"]);
    const secretFilteredCache = await fs.readFile(secretFilterPath, "utf8");
    assert.doesNotMatch(secretFilteredCache, /MUST_NOT_REACH_CACHE|XAI_API_KEY|OAUTH_TOKEN_MUST_NEVER_REACH_CACHE/);

    const directFetch = await fetchXaiModelCatalog(
      { access: TOKEN_SENTINEL },
      { fetchImpl: async () => jsonResponse(additionsFixture) },
    );
    assert.equal(directFetch.kind, "success");

    const grokStartupPath = path.join(tempDir, "grok-startup", "models-v2.json");
    const grokStartup = await selectXaiModelCatalog({
      credential: { access: TOKEN_SENTINEL },
      refreshWhenCredentialsAvailable: true,
      cachePath: grokStartupPath,
      now,
      fetchImpl: async () => jsonResponse(additionsFixture),
    });
    assert.equal(grokStartup.source, "remote");
    assert.equal(grokStartup.needsAuthenticatedRefresh, true, "Grok-backed startup must preserve deferred pi refresh intent");

    await fs.writeFile(`${grokStartupPath}.invalidated`, `1:${now}\n`);
    let markerFetches = 0;
    const markerSelection = await selectXaiModelCatalog({
      credential: { access: TOKEN_SENTINEL },
      cachePath: grokStartupPath,
      now: now + 1,
      fetchImpl: async () => {
        markerFetches++;
        return jsonResponse(removalsFixture);
      },
    });
    assert.equal(markerSelection.source, "remote", "invalidation sidecar must suppress an otherwise fresh cache");
    assert.equal(markerFetches, 1);
    await assert.rejects(fs.stat(`${grokStartupPath}.invalidated`), { code: "ENOENT" });
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }

  console.log("verify-catalog: ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
