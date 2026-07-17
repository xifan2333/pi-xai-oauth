# Issue #68 assertion-parity inventory

This checklist was created **before any production or test migration edit** on
`feature/issue-68-vitest-suites`. It inventories the current `main` regression
surface and assigns every assertion group to a focused destination. Legacy
behavior verifiers may be deleted only after every row is checked and the
replacement tests pass alongside the legacy verifier.

## Baseline

- Baseline commit: `97ac7c9` (`origin/main` when the branch was created).
- Baseline validation: `NODE_OPTIONS=--unhandled-rejections=strict npm test`
  and `npm run typecheck` pass.
- Direct Node `assert.*` call count: **549**:
  - `scripts/verify-extension.js`: 331
  - `scripts/verify-device-auth.js`: 99
  - `scripts/verify-catalog.js`: 72
  - `scripts/verify-setup.js`: 11
  - `scripts/verify-compatibility.js`: 31
  - `scripts/run-compatibility-matrix.js`: 5
- The count is a loss-detection aid, not a coverage target: table-driven Vitest
  cases can preserve several legacy assertion calls in one readable test, and
  new `expect` calls need not match this count one-for-one.

## Destination conventions

- `tests/**/*.test.ts`: typed Vitest behavior suites.
- `tests/fixtures/**`: closure-local typed harnesses and inert fixture data.
- `scripts/verify-extension-loader.mjs`: the one intentionally small real Pi
  loader smoke, run separately and from both packed Pi boundaries.
- `scripts/verify-compatibility.js` and
  `scripts/run-compatibility-matrix.js`: retained plain-Node package/policy
  integration gates.

## Current assertion map

### Catalog and cache — 72 assertions

| Legacy source | Behavior preserved | Destination | Status |
|---|---|---|---|
| `verify-catalog.js:50-133` | additions/removals/empty entitlement exactness; known and unknown metadata; max-token clamp; `none`, implicit, malformed and denied reasoning levels; malformed payload rejection; hidden/backend/API-key/secret filtering; deterministic duplicate handling | `tests/catalog/normalization.test.ts` | [x] |
| `verify-catalog.js:135-184` | fresh cache skips fetch; permissions tighten to `0600`; logged-out startup cannot expose prior account; pinned GET/redirect/header/bearer shape; successful refresh replaces rather than merges; token-free normalized cache | `tests/catalog/cache.test.ts` | [x] |
| `verify-catalog.js:186-241` | credential mtime forces refresh; transient/oversized/malformed success uses eligible stale cache; caller abort and commit-guard cancellation preserve/restore cache | `tests/catalog/cache.test.ts` | [x] |
| `verify-catalog.js:243-292` | auth/permanent and forced-transient invalidation; forced login cannot reuse old-account data; missing cache/deferred refresh retry; too-old and no-credential fallback | `tests/catalog/cache.test.ts` | [x] |
| `verify-catalog.js:294-334` | secret filtering persists to disk; direct fetch success; deferred startup intent; invalidation sidecar suppresses fresh data and clears after commit | `tests/catalog/cache.test.ts` | [x] |

### Device OAuth and refresh — 99 assertions

| Legacy source | Behavior preserved | Destination | Status |
|---|---|---|---|
| `verify-device-auth.js:88-201` | pinned initiation request/result, exact headers/form/signal, expiry cap, schema and verification-URI secret rejection, JSON/64KiB bounds and reader cancellation, safe 404/503/network errors | `tests/oauth/device-initiation.test.ts` | [x] |
| `verify-device-auth.js:203-351` | wait-before-first-poll, default interval, cumulative slow-down, exact endpoint/form, unvalidated ID-token removal, local expiry, denial/error/schema/status/token redaction, bounded streamed token body | `tests/oauth/device-polling.test.ts` | [x] |
| `verify-device-auth.js:353-562` | pre/in-flight/wait/fetch cancellation, late-token expiry, fetch/body timeout aborts, synchronous abort races, reader cancellation/listener removal, timeout disposal after success | `tests/oauth/device-cancellation.test.ts` | [x] |
| `verify-device-auth.js:564-609` | desktop/WSL/SSH/container/headless detection, browser-first selector labels, unsupported method rejection | `tests/oauth/device-login.test.ts` | [x] |
| `verify-device-auth.js:612-692` | device login avoids browser/manual input, safe UI/progress, initial wait, credentials without ID token, common post-login hook, cancellation during handoff | `tests/oauth/device-login.test.ts` | [x] |
| `verify-device-auth.js:694-753` | real Pi credential runtime preserves old credentials on cancellation and persists successful login (`ModelRuntime`/`InMemoryCredentialStore` on current Pi, legacy `AuthStorage` on the minimum boundary) | `tests/oauth/auth-storage.integration.test.ts` | [x] |
| `verify-device-auth.js:755-783` | refresh rotation/preservation, pinned endpoint, no scope renegotiation | `tests/oauth/refresh.test.ts` | [x] |

### Provider registration, catalog lifecycle, and routing — current extension verifier

| Legacy source | Behavior preserved | Destination | Status |
|---|---|---|---|
| `verify-extension.js:2357-2395` | import/load, independent reload registration, provider/tool/command metadata, curated Grok 4.5 advertisement and metadata, known non-advertised model metadata | real load in `scripts/verify-extension-loader.mjs`; behavior detail in `tests/provider/registration.test.ts` | [x] |
| `verify-extension.js:1219-1237` | OAuth/API-key Responses and Images route matrix | `tests/provider/routing.test.ts` | [x] |
| `verify-extension.js:1239-1315` | five model families stream/direct through proxy; POST/model/bearer/protected proxy headers; UUID/session IDs; distinct request IDs; Composer reasoning omission | `tests/responses/routing.test.ts` | [x] |
| `verify-extension.js:1317-1363` | spoofed auth/proxy headers overwritten; sessionless UUID; API-key route uses public endpoint and no proxy metadata | `tests/responses/routing.test.ts` | [x] |
| `verify-extension.js:1365-1386` | client-mode argument/TTY matrix and case-insensitive runtime reasoning lookup | `tests/provider/models.test.ts` | [x] |
| `verify-extension.js:2397-2455` | unentitled helper rejects before network and tools never fall back to `XAI_API_KEY` | `tests/responses/routing.test.ts`, `tests/tools/custom-tools.test.ts` | [x] |
| `verify-extension.js:2467-2502` | credential lookup without Grok 4.5; Grok 4.5 default reasoning; Composer/Build model payload and proxy metadata | `tests/provider/credentials.test.ts`, `tests/tools/custom-tools.test.ts` | [x] |

### Browser OAuth, OIDC, refresh, and provider/catalog races

| Legacy source | Behavior preserved | Destination | Status |
|---|---|---|---|
| `verify-extension.js:1388-1457` | browser remains default; missing/wrong HTTP state rejected before exchange; only matching code exchanged; frozen eight-scope order; verified ID token retained; forced catalog refresh/provider replacement; removed model switches before input | `tests/oauth/browser-login.test.ts`, `tests/provider/catalog-lifecycle.test.ts` | [x] |
| `verify-extension.js:1458-1540` | extension-integrated device request/poll body, safe UI, no ID token, immediate catalog apply, cancellation before poll preserves catalog | `tests/oauth/device-login.test.ts`, `tests/provider/catalog-lifecycle.test.ts` | [x] |
| `verify-extension.js:1541-1575` | authenticated empty catalog removes all models and handles prompt when no replacement exists | `tests/provider/catalog-lifecycle.test.ts` | [x] |
| `verify-extension.js:1576-1609` | expired Pi auth plus fresh Grok auth startup preference and deferred locked refresh intent | `tests/provider/credentials.test.ts` | [x] |
| `verify-extension.js:1610-1710` | late old-account refresh cannot replace new login provider/cache | `tests/provider/catalog-races.test.ts` | [x] |
| `verify-extension.js:1711-1788` | deferred pre-login credential lookup cannot supersede completed login catalog | `tests/provider/catalog-races.test.ts` | [x] |
| `verify-extension.js:1789-1827` | legacy refresh exact request, no scope, refresh preservation, ID-token drop, untrusted endpoint rejection | `tests/oauth/refresh.test.ts` | [x] |
| `verify-extension.js:1828-1964` | raw code rejection/no exchange/safe guidance; matching full callback URL; missing/wrong pasted state ignored while later matching callback succeeds | `tests/oauth/browser-login.test.ts` | [x] |
| `verify-extension.js:1965-2022` | pinned issuer/auth/token/JWKS/ES256/S256 discovery policy fails before browser; OIDC failures occur only after bound exchange | `tests/oauth/oidc.test.ts` | [x] |
| `verify-extension.js:2023-2188` | claim/JOSE/JWK negative matrix; valid multi-audience azp; optional JWK hints | `tests/oauth/oidc.test.ts` | [x] |
| `verify-extension.js:2189-2246` | authorization and token errors redact hostile body values and avoid invalid exchange | `tests/oauth/browser-login.test.ts`, `tests/oauth/refresh.test.ts` | [x] |
| `verify-extension.js:2247-2355` | cancellation before/during discovery, callback wait, token and JWKS; UI failure; callback listeners close | `tests/oauth/browser-cancellation.test.ts` (serial, real loopback) | [x] |

### Responses payload, streaming, and errors

| Legacy source | Behavior preserved | Destination | Status |
|---|---|---|---|
| `verify-extension.js:952-1012` | consumed tool images omitted with marker; pending/current images retained; user images never pruned | `tests/responses/payload.test.ts` | [x] |
| `verify-extension.js:1058-1124` | direct and stream payloads compact before transport, including in-place `onPayload` mutation | `tests/responses/images.test.ts` | [x] |
| `verify-extension.js:1126-1150` | delegated error prefix is xAI, never OpenAI; terminal result extraction | `tests/responses/streaming.test.ts` | [x] |
| `verify-extension.js:1152-1217` | real Pi OpenAI Responses transport reaches configured endpoint; xAI transport bypasses conflicting compat registration and returns terminal result | real loader registration in `scripts/verify-extension-loader.mjs`; compat forwarding details in `tests/responses/streaming.test.ts` | [x] |
| payload behavior currently exercised indirectly throughout verifier | developer/system instructions, CLI reasoning/include cleanup, response format, cache retention/key, image normalization | `tests/responses/payload.test.ts` | [x] |
| `verify-extension.js:2519-2532` | provider error is one request, translated with status, and keeps active model | `tests/responses/streaming.test.ts`, `tests/tools/custom-tools.test.ts` | [x] |

### Images — codec, replay, transport, and Images API

| Legacy source | Behavior preserved | Destination | Status |
|---|---|---|---|
| `verify-extension.js:1014-1056` | under-budget byte identity; aggregate budget; PNG/JPEG and <=2000 dimensions; undecodable oversized local failure | `tests/images/compaction.test.ts` | [x] |
| `verify-extension.js:1058-1124` | direct/stream/hook compaction | `tests/responses/images.test.ts` | [x] |
| `verify-extension.js:2543-2598` | analysis part ordering; direct Images route; default model; omitted unsupported defaults; schema min/max; explicit count; unsupported size and invalid count fail before network | `tests/images/tools.test.ts` | [x] |

### Network-tool lifecycle and `/xai-tools`

| Legacy source | Behavior preserved | Destination | Status |
|---|---|---|---|
| `verify-extension.js:594-691` | registered network catalog exactness; reset/opt-in; no lifecycle network; registry failures retry/fail closed; registry injection cannot bypass authorization; leaving/returning model stays disabled; guard precedes credential/network | `tests/tools/model-scope.test.ts` | [x] |
| `verify-extension.js:692-923` | command registration; explicit image intent; enable/disable/reset/preserve; TUI selection, toggle, page wrap and escape; RPC picker; eligibility/risk/status; selective disable; registry failure/recovery leaves only explicitly authorized tools | `tests/tools/commands.test.ts` | [x] |

### Custom xAI tools

| Legacy source | Behavior preserved | Destination | Status |
|---|---|---|---|
| `verify-extension.js:2397-2502` | entitlement/credential guard, no env API-key fallback, active entitled credential, text reasoning/model and CLI metadata | `tests/tools/custom-tools.test.ts` | [x] |
| `verify-extension.js:2503-2542` | web and X search tool bodies/model/date filters; provider error single-attempt; code-interpreter shape | `tests/tools/custom-tools.test.ts` | [x] |
| `verify-extension.js:2543-2598` | image analysis and generation schemas/routes/validation | `tests/images/tools.test.ts` | [x] |
| `verify-extension.js:2599-2610` | multi-agent model, effort, agent count/details, web and X tools | `tests/tools/custom-tools.test.ts` | [x] |
| registered critique/deep-research behavior and common disabled guard | schemas and request shapes are covered explicitly rather than only registration | `tests/tools/custom-tools.test.ts` | [x] |

### Cursor/Grok CLI shims

| Legacy source | Behavior preserved | Destination | Status |
|---|---|---|---|
| `verify-extension.js:432-545` | all shim registration; WebSearch opt-in/model routing/stale guard; Grep aliases/context/schema/required pattern/unsafe regex; Glob/Read/Write/Edit/Shell/Delete real adapters | `tests/tools/cursor-shims.test.ts` with temp workspace | [x] |
| `verify-extension.js:546-592` | Composer activation/idempotence, manual WebSearch disable, prune on model/session/before-agent, registry read/write failure tolerance/no partial state | `tests/tools/cursor-shims.test.ts` | [x] |
| cursor argument normalization and workspace escape behavior | aliases, JSON/string coercion, numeric/boolean coercion, path refusal | `tests/tools/cursor-args.test.ts` | [x] |

### Setup/settings — 11 assertions

| Legacy source | Behavior preserved | Destination | Status |
|---|---|---|---|
| `verify-setup.js:33-39` | scoped/unscoped npm specs with versions; non-npm undefined | `tests/setup/settings.test.ts` | [x] |
| `verify-setup.js:40-64` | local duplicate pruning; unrelated package preservation; object entry; npm insertion flag | `tests/setup/settings.test.ts` | [x] |
| `verify-setup.js:66-78` | temp settings update writes pruned package/default configuration | `tests/setup/settings.test.ts` | [x] |

### Compatibility policy/package helpers — 36 assertions retained in Node

| Legacy source | Behavior preserved | Destination | Status |
|---|---|---|---|
| `verify-compatibility.js:16-75` | exact semver/range parsing, comparisons, range satisfaction, command failure and peer diagnostics | retained in the authoritative plain-Node `scripts/verify-compatibility.js` integration gate | [x] |
| `verify-compatibility.js:78-135` | policy package list, aligned peer bounds, supported/unsupported endpoints, exact dev and lock metadata, CI matrix source/non-duplication | retain `node scripts/verify-compatibility.js policy` | [x] |
| `verify-compatibility.js:137-159` | registry minimum/current-latest sentinel | retain `registry` mode | [x] |
| `verify-compatibility.js:161-213` | one tarball, packed identity/peers/required/forbidden paths | retain `pack` mode; add Vitest config/tests/fixtures/loader smoke to required list | [x] |
| `verify-compatibility.js:215-269` | unsupported strict failure and forced warning diagnostics | retain `unsupported` mode | [x] |
| `verify-compatibility.js:271-291` | matrix output and command dispatch | retain plain-Node CLI | [x] |
| `run-compatibility-matrix.js:34-114` | alias/exact parsing, checked endpoint restriction, one tarball, exact installed Pi pair, packed `npm test` and typecheck | retain clean packed matrix at 0.80.1/0.80.10 | [x] |

## Isolation checklist

- [x] Every fetch mock is injected or installed with `vi.stubGlobal` and matched;
      `afterEach` restores globals.
- [x] Fake timers/system time are restored; real loopback tests never run on fake
      timers.
- [x] Environment variables (especially `HOME` and `XAI_API_KEY`) are restored.
- [x] Every temp home/cache/workspace is unique and recursively removed.
- [x] Runtime models return to curated fallback after each test.
- [x] Extension API objects and active-tool registries are new per test.
- [x] Modules with WeakMap/WeakSet/import-captured state are reset or exercised
      with fresh API objects and deterministic imports.
- [x] Callback servers, streams, abort listeners, and pending promises settle and
      close before each test ends.
- [x] No suite performs a live xAI request.
- [x] `NODE_OPTIONS=--unhandled-rejections=strict` passes the full gate.

## Deletion gate

The following files may be removed only after all applicable rows above are
checked and both old and new tests have passed in the same working tree:

- `scripts/verify-extension.js`
- `scripts/verify-device-auth.js`
- `scripts/verify-catalog.js`
- `scripts/verify-setup.js`

The compatibility verifier and matrix runner remain. The replacement loader
smoke must be small enough that behavior failures live in named Vitest tests,
not in another monolith.

**Completed evidence:** all legacy and replacement behavior tests passed together
under strict unhandled-rejection handling before the four legacy files were
removed. The final replacement suite has 246 named tests across 29 files, the
loader smoke is 40 lines, every live destination path above exists, and three
independent parity review rounds ended with a CLEAN focused re-review.
