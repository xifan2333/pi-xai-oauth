# Shared Agent Context

**Project:** pi-xai-oauth
**Branch:** feature/issue-67-oauth-state-oidc
**Date:** 2026-07-16

## Issue
Issue #67 reports that token-shaped manual input is marked `trustedManualCode` and exchanged without OAuth state, while fresh-login ID tokens are stored without signature or claim validation. The fix must bind every authorization completion to its in-memory transaction and validate retained OIDC identity material.

## First-party and normative contract
- OIDC trust root: `https://auth.x.ai/.well-known/openid-configuration`.
- Exact issuer: `https://auth.x.ai`.
- Exact authorization endpoint: `https://auth.x.ai/oauth2/authorize`.
- Exact token endpoint: `https://auth.x.ai/oauth2/token`.
- Exact JWKS endpoint: `https://auth.x.ai/.well-known/jwks.json`.
- Current ID-token algorithm/key shape: ES256 with public EC P-256 signing JWKs selected by `kid`.
- Current PKCE method: S256.
- OIDC Core requires fresh code-flow ID-token validation for exact issuer, client audience, expiry, nonce, and issuer signing key before tokens are accepted.
- xAI's generic RFC 8414 metadata currently differs from its OIDC metadata; this OIDC client must not merge or fall back between them.

## Scope decisions
- Raw authorization codes are rejected because they carry no state. Users must paste the complete redirect URL containing matching `code` and `state`.
- Device authorization is not implemented here; issue #66 owns method selection, device endpoint requests, polling, expiry, cancellation, and remote/headless UX.
- Existing `~/.grok/auth.json` reuse and refresh remain compatible. Existing credentials are not deleted, revoked, or retroactively treated as fresh OIDC responses.
- Fresh login requires and validates an ID token before credentials are returned. Refresh responses do not retain a new ID token unless a future design supplies the original validated identity context required by OIDC refresh rules.
- Token endpoint response bodies, authorization codes, tokens, verifiers, state, and nonce must never be logged or included in errors.

## Test strategy
Use generated ES256/P-256 test keys and local JWT fixtures. Exercise HTTP and pasted callbacks, token-request capture, cancellation/listener cleanup, discovery/JWKS policy, signature/key failures, issuer/audience/nonce/expiry failures, refresh fallback/unvalidated-ID-token discard, and exact valid ID-token retention. No test uses production keys or credentials.

## Validation state
- LSP diagnostics, `npm test`, strict-unhandled focused verification, `npm run typecheck`, and `git diff --check` pass.
- Dry-run package inspection includes `extensions/xai/oidc.ts` and excludes scaffold, subagent, credential, key, and local artifacts.
- Two independent review rounds completed; accepted findings were fixed and the final security review reported no blockers.
- Live interactive OAuth was not attempted because browser/TUI interaction is not safely available through this tool pane. Existing credentials were not read, removed, rewritten, or revoked.

## Delivery
The reviewed implementation was committed as `3721691`, pushed on `feature/issue-67-oauth-state-oidc`, and opened against `main` as unmerged PR #72: https://github.com/BlockedPath/pi-xai-oauth/pull/72
