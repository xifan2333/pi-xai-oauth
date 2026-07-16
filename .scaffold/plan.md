# Implementation Plan: Issue #63 OAuth-aware xAI routing

**Branch:** feature/issue-63-auth-aware-routing
**Date:** 2026-07-16

## Goal
Route xAI Responses traffic by credential kind rather than model ID: OAuth/session credentials use the official Grok CLI proxy, while a future explicit API-key path stays on the public xAI API.

## Implementation
- [x] Add a credential- and operation-aware routing module.
- [x] Separate Grok Build/Composer compatibility classification from endpoint selection.
- [x] Return tagged OAuth credentials from the current OAuth-only auth resolver.
- [x] Route provider streaming and every direct Responses helper through the shared resolver.
- [x] Audit image generation through the resolver while preserving the official direct `api.x.ai` exception.
- [x] Add table-driven regression coverage for Grok 4.5, Grok 4.3, Grok 4.20, Grok Build, Composer, API-key routing, and image generation.
- [x] Document a subscription-only manual smoke test and update the Unreleased changelog.

## Validation Contract
- [x] `npm run typecheck`
- [x] `npm test`
- [x] `git diff --check`
- [x] `npm pack --dry-run --json` includes `extensions/xai/routing.ts` and excludes temporary subagent/scaffold/session artifacts.
- [x] Two fresh-context review rounds completed; round 2 found no code or documentation blockers.
- [x] Manual subscription-only smoke test is documented.
- [ ] Live subscription-only smoke passes: executed on 2026-07-16 with OAuth present and `XAI_API_KEY` absent; Grok Build and Composer passed, while Grok 4.5, Grok 4.3, Grok 4.20, and the direct Grok 4.5 helper reached the proxy but failed with HTTP 426 because standard models did not send the required Grok client-version header. Header alignment remains the separately scoped non-goal tracked by GitHub issue #65.

## Scope Decisions
- Header and OAuth scope alignment remain out of scope per issue #63.
- Image generation remains at `https://api.x.ai/v1/images/generations` for OAuth and API-key credentials, matching official Grok Build commit `b189869`.
- This package remains OAuth-only; API-key routing is an internal, explicitly tagged future path.
