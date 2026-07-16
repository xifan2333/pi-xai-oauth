# Implementation Plan: Issue #65 OAuth scopes and proxy metadata

**Branch:** feature/issue-65-proxy-headers
**Date:** 2026-07-16

## Goal
Align fresh xAI OAuth grants and every OAuth Responses request with the pinned official Grok Build scope and CLI-proxy metadata contracts without changing credential-aware endpoint routing.

## Implementation
- [x] Request the frozen eight-scope OAuth contract for fresh browser logins.
- [x] Preserve legacy refresh behavior without scope renegotiation.
- [x] Derive the truthful `pi-xai-oauth` client identifier and version from package metadata.
- [x] Add required auth-response and interactive/headless client-mode headers to every OAuth proxy request.
- [x] Add request, conversation, session, and model headers for streaming and direct Responses calls.
- [x] Keep required proxy metadata authoritative over caller-supplied headers.
- [x] Keep API-key Responses free of OAuth proxy-only metadata.
- [x] Add exact outgoing-request, OAuth-scope, refresh-body, spoof-protection, and client-mode regression coverage.
- [x] Document refresh compatibility and the fresh re-login path for new scopes.

## Validation Contract
- [x] Focused extension verification passes.
- [x] `npm run typecheck` passes.
- [x] Full `npm test` passes.
- [x] `git diff --check` passes after documentation/scaffold updates.
- [x] Parent-owned LSP diagnostics pass on the final TypeScript source (the persistent server cache was cross-checked with fresh exact-source copies).
- [x] `npm pack --dry-run --json` contains package metadata and changed runtime files while excluding scaffold, subagent, credential, and session artifacts.
- [x] Parent-owned safe live OAuth smoke returned `OAUTH_PROXY_OK` for Grok 4.5, Grok Build, and Composer; no image generation was invoked.
- [x] Independent focused review/fix passes completed; client-mode parsing and authorization-spoof findings were fixed and revalidated.

## Scope Decisions
- Endpoint selection remains credential-aware in `extensions/xai/routing.ts`; model checks do not select transport.
- Grok Build/Composer payload and local tool compatibility remain model-specific and unchanged.
- Existing refresh tokens continue using their original grant; only a fresh login can add newly requested scopes.
- Direct Responses calls mint their own coherent conversation/session UUID instead of treating `previous_response_id` as a session identifier.
- The OAuth-only provider does not add API-key fallback and never logs or exposes bearer tokens.
