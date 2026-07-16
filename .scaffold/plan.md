# Implementation Plan: Issue #66 device-code authentication

**Branch:** feature/issue-66-device-code-auth
**Date:** 2026-07-16

## Goal
Add secure, cancellable xAI device authorization for remote/headless human login while keeping browser authorization-code + PKCE first/default and preserving OAuth/OIDC, refresh, catalog, routing, and credential behavior from PRs #70-#73.

## Implementation
- [x] Add pinned device endpoint/protocol constants and a focused dependency-injected device authorization module.
- [x] Validate incrementally bounded device/token JSON, exact first-party URLs, safe user codes, intervals/expiry, and required access/refresh tokens without reflecting secrets or raw bodies.
- [x] Poll with an initial wait, at least the server interval, cumulative 5-second `slow_down`, AbortSignal cancellation, bounded requests, and `min(expires_in, 15 minutes)` timeout.
- [x] Add pi-native browser/device selection with browser first/default; environment detection changes recommendation text only.
- [x] Send device success through the existing credential converter, post-login catalog refresh, and pi persistence path; ignore device ID tokens.
- [x] Add deterministic focused protocol/method/context/timing/error/cancellation/rotation tests plus provider/catalog and AuthStorage integration coverage.
- [x] Document browser versus device choice and `/login`/`/reload`/catalog behavior; update setup, changelog, AGENTS, and scaffold state.

## Preservation Boundaries
- Keep browser PKCE S256, callback state matching, raw-code rejection, pinned discovery/token/JWKS, nonce, and ES256 ID-token validation unchanged.
- Keep current client ID, ordered eight scopes, proxy headers/routing, authenticated catalog exactness, and refresh-token rotation/preservation.
- Never write/delete/revoke `~/.grok/auth.json`; pi writes its credential only after a selected login succeeds.
- Never trust response-provided device/token endpoints, arbitrary `*.x.ai` endpoints, or upstream error text.
- Do not attempt a live device flow without explicit user interaction in this pane.

## Validation Contract
- [x] Changed-file LSP diagnostics.
- [x] `node --unhandled-rejections=strict scripts/verify-device-auth.js`.
- [x] Final `NODE_OPTIONS=--unhandled-rejections=strict npm test` after review fixes.
- [x] `npm run typecheck`.
- [x] `git diff --check`.
- [x] Final `npm pack --dry-run --json` inspection (45 intended files; required runtime/tests/docs present; no scaffold, credentials, caches, or subagent artifacts).
- [x] Independent correctness/security/timing/test/docs/package review completed; accepted fixes applied.
- [x] Focused re-review reported `CLEAN`; final full validation passed.

## Delivery
- [x] Committed reviewed implementation as `9968f3b` on `feature/issue-66-device-code-auth`.
- [x] Pushed the feature branch to origin.
- [x] Opened unmerged PR #75 against `main`, closing #66: https://github.com/BlockedPath/pi-xai-oauth/pull/75
