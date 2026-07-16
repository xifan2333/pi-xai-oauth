# Shared Agent Context

**Project:** pi-xai-oauth
**Branch:** feature/issue-63-auth-aware-routing
**Date:** 2026-07-16

## Issue
GitHub issue #63 reports that the OAuth-only `xai-auth` provider incorrectly routes ordinary Grok models to `api.x.ai`; only Grok Build and Composer previously used the official session-token proxy.

## Confirmed Contract
- OAuth/session-token Responses inference → `https://cli-chat-proxy.grok.com/v1`.
- Explicit external API-key Responses inference → `https://api.x.ai/v1`.
- Endpoint selection must not depend on model ID or token shape.
- Grok Build/Composer payload cleanup, Cursor shims, tool eligibility, and existing proxy headers remain model-specific compatibility behavior.
- Official Grok Build commit `b189869` deliberately sends image generation for both OAuth and BYOK directly to `xai_api_base_url`.

## Completed Implementation
- Rebased onto current `origin/main`, preserving PR #62's selective `/xai-tools disable` fix.
- Added one explicit credential/request routing matrix for OAuth-session and API-key Responses plus image generation.
- Routed provider streaming and all direct OAuth Responses helpers through `cli-chat-proxy.grok.com`.
- Preserved `api.x.ai` for an explicit future API-key Responses path and both image-generation credential kinds.
- Kept Build/Composer compatibility payloads, headers, Cursor shims, and WebSearch eligibility model-specific.
- Added actual-request regression coverage for Grok 4.5, Grok 4.3, Grok 4.20 reasoning, Grok Build, and Composer across streaming and direct helpers.
- Documented a subscription-only manual smoke test and the image-generation exception.

## Validation
- `npm test`, `npm run typecheck`, and `git diff --check` pass before the final rebase.
- `npm pack --dry-run --json` includes the routing module and excludes temporary subagent/scaffold/session artifacts.
- Two fresh-context review rounds found no remaining code or documentation blockers.
- Live OAuth smoke: Grok Build and Composer passed; Grok 4.5, Grok 4.3, Grok 4.20 reasoning, and the direct Grok 4.5 helper reached the proxy but failed HTTP 426 because the required Grok client-version header was absent.

## Current Focus
GitHub issue #65 tracks the proxy-header and OAuth-scope alignment exposed by the live smoke. Issue #63 remains focused on endpoint selection.
