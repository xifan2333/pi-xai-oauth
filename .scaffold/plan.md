# Implementation Plan: Issue #64 authenticated OAuth model catalog

**Branch:** feature/issue-64-oauth-model-catalog
**Date:** 2026-07-16

## Goal
Replace the release-bound OAuth model advertisement with an authenticated, entitlement-aware `/models-v2` catalog while preserving a small safe fallback, bounded startup, existing routing/header/OIDC behavior, and model-specific compatibility.

## Implementation
- [x] Add a focused catalog module with defensive `/models-v2` normalization, pinned Responses-backend handling, hidden/API-key-only rejection, and exact replacement semantics for additions/removals.
- [x] Add an atomic token-free last-known-good cache under pi's user cache directory.
- [x] Use a 15-minute fresh TTL, an official-aligned bounded 5-second stale refresh, a 7-day stale-if-transient window, durable invalidation for auth/permanent failures, and forced no-stale refresh after successful login.
- [x] Make the extension factory async so the selected catalog is registered before startup and `--list-models`; re-register immediately after login so `/model` sees new entitlements without `/reload`.
- [x] Defer expired pi-owned token refresh to `session_start` through the bound model registry/credential lock.
- [x] Keep direct helper metadata synchronized with the active catalog while preserving Grok 4.5, Build, Composer, 4.20, routing, headers/scopes, payload, and OIDC compatibility logic.
- [x] Add fixture-based tests for additions, removals, malformed entries, duplicate/API-key-only/unsupported-backend filtering, reasoning metadata, fresh/stale cache, auth/network failures, and fallback choice.
- [x] Update README, CHANGELOG, AGENTS.md, and scaffold state with refresh/login/reload/model-selection and cache policy.

## Non-goals
- Do not add API-key auth or expose API-key-only models.
- Do not alter issue #63 credential-aware Responses/Images routing, issue #65 scopes/proxy headers, issue #67 OAuth state/OIDC validation, or issue #66 device login.
- Do not call paid generation/search/image tools during validation.
- Do not persist or log access/refresh/ID tokens or raw catalog payloads.

## Validation Contract
- [x] Changed-file LSP diagnostics pass.
- [x] `npm test` passes.
- [x] `npm run typecheck` passes.
- [x] `git diff --check` passes.
- [x] `npm pack --dry-run --json` contains required runtime/fixtures/docs and excludes credentials/cache/scaffold/subagent artifacts.
- [x] Safe authenticated GET-only `/models-v2` smoke succeeds when credentials are available without printing credentials.
- [x] Independent correctness, security, cache, and test reviews complete; accepted fixes are applied and revalidated.

## Delivery
- [x] Committed reviewed implementation as `70436d2`.
- [x] Pushed `feature/issue-64-oauth-model-catalog`.
- [x] Opened unmerged PR #73 against `main`, closing #64: https://github.com/BlockedPath/pi-xai-oauth/pull/73
