# Shared Agent Context

**Project:** pi-xai-oauth
**Branch:** feature/issue-65-proxy-headers
**Date:** 2026-07-16

## Issue
GitHub issue #65 reports that fresh OAuth scopes and CLI-proxy request metadata lag the official Grok Build client. PR #70 already made Responses routing credential-aware; this issue changes the protocol metadata sent after routing, not endpoint selection.

## Pinned Official Contract
- Fresh personal OAuth grants request, in order: `openid profile email offline_access grok-cli:access api:access conversations:read conversations:write`.
- Refresh exchanges send the existing refresh token and client ID without a new scope parameter.
- Authenticated CLI-proxy requests require package/client version, `X-XAI-Token-Auth: xai-grok-cli`, `x-authenticateresponse: authenticate-response`, and client mode.
- Official sampling transport also emits conversation, request, model override, and session identifiers per request.
- Client mode is `headless` for pi print/explicit non-TUI mode and `interactive` otherwise.

## Implementation
- `extensions/xai/constants.ts` derives client name/version from module-relative `package.json` and carries the eight-scope fresh-login string.
- `extensions/xai/models.ts` builds the complete OAuth proxy header set for all OAuth models and keeps API-key requests header-free.
- `extensions/xai/responses.ts` applies stable stream session IDs (with UUID fallback), fresh request IDs, and coherent direct-call conversation/session UUIDs. Required metadata wins over caller headers.
- Build/Composer capability checks remain limited to payload/tool/shim compatibility; `routing.ts` remains unchanged.
- `scripts/verify-extension.js` asserts exact actual-fetch request shapes, scope order, legacy refresh forms, client modes, spoof resistance, and API-key absence.

## User Migration
Older credentials may continue refreshing and working, but refresh does not add `conversations:read` or `conversations:write`. To obtain the expanded grant, run `/login xai-auth` and answer `n` if prompted to reuse `~/.grok/auth.json`, forcing a fresh browser authorization.

## Validation State
- LSP diagnostics, locked TypeScript 7.0.2 typecheck, `npm test`, and `git diff --check` pass.
- Package inspection includes the changed runtime files and package metadata and excludes scaffold, subagent, credential, and session artifacts.
- Live OAuth smoke with `XAI_API_KEY` unset returned `OAUTH_PROXY_OK` for Grok 4.5, Grok Build, and Composer. Grok Build retried one transient upstream 503 before succeeding.
- Independent review found and fixed client-mode parsing and authorization-spoof gaps; focused regression coverage passes.

## Remaining Work
Commit, push, and open the issue #65 PR against `main` without merging it. Do not invoke paid image generation.
