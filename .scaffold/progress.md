# Execution Progress

**Project:** pi-xai-oauth Issue #64 authenticated OAuth model catalog
**Branch:** feature/issue-64-oauth-model-catalog
**Started:** 2026-07-16

## Research and Baseline
- [x] Updated clean `main` through merged PRs #70/#71/#72 and created the requested feature branch before editing.
- [x] Read AGENTS.md, complete issue #64 (no comments), PR #70/#71/#72 summaries, provider/setup/model/auth/routing/OAuth/OIDC/payload/Responses/tool code, current tests, README, changelog, and scaffold state.
- [x] Read pi's complete custom-provider, models, providers, SDK/model-registry, and extensions docs plus complete custom-provider/OAuth/model selection/reload examples.
- [x] Read the pinned official Grok Build `/models-v2` refresh/parser and API-key-only catalog sources at commit `b189869...`.
- [x] Confirmed baseline changed-file diagnostics, `npm test`, and `npm run typecheck` pass (test script retains only pre-existing CommonJS/jiti hints).
- [x] Performed a safe GET-only authenticated live `/models-v2` smoke: HTTP 200, two OAuth-visible Responses models, no token/header/body logging and no paid tool invocation.

## Current Findings
- The live authenticated catalog currently exposes `grok-4.5` and `grok-composer-2.5-fast` for this account; the response supplies backend/context/reasoning metadata but currently omits max-completion tokens.
- pi requires dynamic model discovery in an async extension factory so models exist at startup and `--list-models`; post-start `registerProvider` calls apply immediately.
- Successful login can force-refresh and immediately re-register the provider; `/reload` reruns the async factory and respects the explicit cache TTL.
- The cache must store normalized model definitions only and must not reuse stale entitlements after 401/403.

## Implementation
- [x] Completed independent research and planning review; accepted forced-login no-stale behavior, durable invalidation, exact empty-catalog replacement, a 5-second official-aligned bound, and lock-safe expired-token handling.
- [x] Added defensive normalization for official aliases, Responses-only routing, hidden/API-key-only/malformed filtering, known metadata enrichment, conservative unknown defaults, reasoning capability, and supplied levels.
- [x] Added an atomic 0600 token-free normalized cache with 15-minute freshness, 7-day stale-if-transient behavior, and auth/permanent/forced-failure tombstones.
- [x] Made provider startup async, added exact unregister/register replacement, forced post-login refresh, deferred lock-protected session refresh, and removed-active-model fail-safe handling.
- [x] Added fixture-based catalog/cache/failure tests and updated the extension harness for async load and login/empty-catalog replacement.
- [x] Updated README, CHANGELOG, AGENTS.md, and scaffold policy documentation.

## Review Fixes
- [x] Completed four independent correctness, security/privacy, cache/normalization, and regression/docs/package reviews.
- [x] Prevented cross-account refresh coalescing and aborts superseded requests so an older completion cannot overwrite provider state or cache.
- [x] Bypassed fresh cache after logout/no credentials and when the credential file changed after the cache; preserved lock-refresh intent across fresh cache and retryable lookup failures.
- [x] Added caller-cancellation handling that leaves cache/provider state untouched.
- [x] Added pre-input model reconciliation plus transport/direct-helper entitlement guards; additional helpers default to the active entitled model.
- [x] Fixed `none` reasoning mapping, capability-without-level defaults, known-output/context clamping, mixed malformed filtering, cache-write invalidation, and permissive cache permissions.
- [x] Added overlap, removed-model, no-replacement, logout/fresh-cache, credential-change, cancellation, oversized-response, permissions, reasoning, and limit regressions.
- [x] Documented pi's empty-catalog + disk-defined `xai-auth` model limitation; transport remains fail-closed before network.

## Validation
- [x] Changed TypeScript files have zero LSP errors/warnings; JS verifiers retain only pre-existing CommonJS/jiti hints.
- [x] `npm test` passes (`verify-catalog`, `verify-extension`, `verify-setup`).
- [x] `npm run typecheck` passes.
- [x] `git diff --check` passes.
- [x] `npm pack --dry-run --json` includes 43 intended files including `catalog.ts` and fixtures; no scaffold, subagent, credential, session, or cache artifacts.
- [x] Safe live authenticated GET-only smoke through the implemented selector succeeded with source `remote`, two models, and no paid tool invocation or credential/header logging.

- [x] Final focused race-condition re-review reproduced the prior commit-window issue, accepted the queued conditional rollback fix, reran the deterministic probe, and reported `CLEAN`.

## Post-PR Recheck
- [x] Re-read PR #73 status, automated reviews, inline comments, and checks after the user requested another check.
- [x] Accepted and fixed active-catalog credential lookup when Grok 4.5 is absent, empty/malformed reasoning-level defaults, lock-refreshed deferred entitlement validation, case-insensitive runtime reasoning lookup, and transient retry retention/backoff.
- [x] Added focused regressions for Composer-only credential lookup, empty/malformed reasoning lists, mixed-case runtime IDs, fresh-cache deferred refresh, and retryable transient failures.
- [x] Re-ran focused catalog/extension tests, full `npm test`, typecheck, diff check, package inspection, and LSP diagnostics successfully.
- [x] Independent post-feedback review caught and fixed a superseded retry-deadline race; focused re-review reported `CLEAN`.
- [x] A second PR recheck found five additional Cursor findings; fixed failed-commit stale-cache refusal, expired-pi/fresh-Grok startup fallback, non-abort login fallback application, login/deferred refresh priority, and runtime-entitlement event gating.
- [x] Added expired-pi/fresh-Grok, Grok-backed deferred-intent, disk-defined-unentitled, invalidation-sidecar, and credential-lookup/login-priority regressions; re-ran focused validation.
- [x] Independent fault-injection/concurrency re-review verified all second-round fixes and reported `CLEAN — no blockers found`.
- [x] A third PR recheck found one reasoning-denial issue; explicit `supportsReasoningEffort: false` now overrides known reasoning metadata and ignores supplied effort levels, with a focused regression.

## Delivery
- [x] Committed the reviewed implementation as `70436d2`.
- [x] Pushed `feature/issue-64-oauth-model-catalog` to `origin`.
- [x] Opened PR #73 against `main` without merging: https://github.com/BlockedPath/pi-xai-oauth/pull/73

## Next
Leave PR #73 unmerged for external review.
