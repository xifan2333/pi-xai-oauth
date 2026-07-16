# Execution Progress

**Project:** pi-xai-oauth Issue #63 OAuth-aware endpoint routing
**Branch:** feature/issue-63-auth-aware-routing
**Started:** 2026-07-16

## Inherited Mainline Fixes
- [x] Rebased onto current `origin/main`.
- [x] Preserved PR #62's fix so disabling one xAI tool without an active xAI model does not clear sibling authorizations.

## Issue #63 Implementation
- [x] Read issue #63, current provider/request paths, pi custom-provider docs/examples, and official Grok Build routing source.
- [x] Confirmed baseline `npm run typecheck` and `npm test` pass.
- [x] Completed parallel local audit, official-source research, and implementation planning.
- [x] Clarified the image-generation exception: official Grok Build sends OAuth and BYOK Imagine requests directly to `api.x.ai`.
- [x] Implemented credential-aware Responses routing: OAuth/session traffic uses the CLI proxy and an explicit future API-key path uses `api.x.ai`.
- [x] Routed image generation through the same abstraction while preserving its official direct `api.x.ai` exception.
- [x] Renamed the Build/Composer predicate so compatibility behavior remains separate from endpoint selection.
- [x] Added table-driven actual-request coverage for OAuth streaming/direct helpers across Grok 4.5, Grok 4.3, Grok 4.20, Grok Build, and Composer.
- [x] Added explicit API-key Responses and OAuth/API-key image-route coverage while preserving Build/Composer-only compatibility headers.
- [x] Corrected TUI `/login` documentation and documented the subscription-only smoke flow.
- [x] Completed two fresh-context review rounds and applied accepted documentation/metadata findings.
- [x] Passed LSP diagnostics, `npm test`, `npm run typecheck`, `git diff --check`, and npm package inspection before the final rebase.

## Live Smoke
- [x] Installed the local checkout as the only `pi-xai-oauth` package.
- [x] Verified OAuth credentials are present while `XAI_API_KEY` is absent.
- [x] Grok Build and Composer returned `OAUTH_PROXY_OK`.
- [x] Confirmed Grok 4.5, Grok 4.3, Grok 4.20 reasoning, and the direct Grok 4.5 helper reach the proxy.
- [ ] Standard-model requests currently fail HTTP 426 because the required Grok client-version header is absent; GitHub issue #65 tracks header/scope alignment.

## Next
- [ ] Re-run full validation after rebase, push the branch, and open the issue #63 PR.
- [ ] Address issue #65 separately before claiming all standard-model OAuth traffic is end-to-end operational.
