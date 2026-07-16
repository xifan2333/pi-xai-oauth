# Implementation Plan: Issue #67 OAuth state and OIDC validation

**Branch:** feature/issue-67-oauth-state-oidc
**Date:** 2026-07-16

## Goal
Remove the unbound raw authorization-code fallback and make fresh xAI browser OAuth completion fail closed on transaction state plus validated first-party OIDC identity metadata.

## Implementation
- [x] Remove `trustedManualCode` and reject raw-code-only manual input with a safe migration message.
- [x] Require the expected state on every HTTP or pasted callback before token exchange.
- [x] Pin and validate xAI OIDC issuer, authorization endpoint, token endpoint, JWKS endpoint, ES256, and S256 metadata.
- [x] Validate fresh-login ID tokens before retaining credentials: compact JWS shape, ES256 signature, matching P-256 signing key, issuer, audience/authorized party, expiry, required claims, and nonce.
- [x] Preserve existing Grok CLI credential reuse and refresh compatibility without retaining unvalidated refresh ID tokens.
- [x] Stop reflecting authorization/token endpoint response data in errors.
- [x] Add focused wrong/missing-state, raw-code migration, code-substitution, cancellation/cleanup, discovery/JWKS, ID-token failure, and valid-completion tests.
- [x] Update README, CHANGELOG, AGENTS.md, and scaffold security guidance.

## Non-goals
- Do not implement device authorization; full device-code UX, polling, and cancellation remain tracked by issue #66.
- Do not revoke, delete, migrate, or rewrite existing user credentials.
- Do not change model routing, scopes, tools, payloads, or xAI API behavior outside issue #67.

## Validation Contract
- [x] LSP diagnostics pass for changed TypeScript files.
- [x] `npm test` passes.
- [x] `npm run typecheck` passes.
- [x] `git diff --check` passes.
- [x] `npm pack --dry-run --json` contains intended runtime/docs files and no local artifacts or credentials.
- [x] Independent security, correctness, and test reviews complete; accepted fixes are applied and revalidated.
- [x] Live OAuth was not attempted because this tool pane cannot safely hand browser/TUI interaction to the user; existing credentials were not read, removed, rewritten, or revoked.

## Delivery
- [ ] Commit reviewed implementation.
- [ ] Push `feature/issue-67-oauth-state-oidc`.
- [ ] Open a PR against `main` without merging it.
