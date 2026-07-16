# Shared Agent Context

**Project:** pi-xai-oauth
**Branch:** feature/issue-64-oauth-model-catalog
**Date:** 2026-07-16

## Issue contract
Issue #64 requires authenticated OAuth-visible `/models-v2` discovery, exact entitlement/removal filtering, defensive metadata normalization, explicit refresh/cache/fallback behavior, lifecycle integration, fixture tests, documentation, safe live smoke, and delivery as an unmerged PR.

## Authoritative behavior
- Official session users fetch `{cli proxy base}/models-v2` with bearer auth, `X-XAI-Token-Auth: xai-grok-cli`, client version, and client mode; official idle refresh uses a 5-second bound and skips BYOK.
- Official parsing accepts `model`/`modelId`/`id`, name, `apiBackend`, context-window variants, max-completion variants, reasoning capability/default/options, hidden flags, and `_meta` fallbacks.
- Official catalog guidance says `grok-build-0.1` is API-key-only and excluded from OAuth catalogs.
- pi awaits async extension factories before startup/session events/provider flush, making that the correct dynamic-model hook. Provider re-registration after startup is immediate. `/reload` recreates the extension runtime.

## Planned policy
- Cache path: pi agent cache directory, `cache/pi-xai-oauth/models-v2.json`.
- Fresh TTL: 15 minutes (startup uses cache without network).
- Stale refresh: one redirect-refusing authenticated GET bounded to the official client's 5 seconds.
- Stale-if-transient: normalized LKG up to 7 days for network/timeout/429/5xx/invalid-success failures.
- Auth/permanent failure or unusable/no cache: the documented `grok-4.5`-only curated fallback; 401/403 never reuse stale entitlements.
- Successful login always forces refresh, forbids stale reuse on every failure, invalidates the old account cache if refresh fails, and immediately re-registers models.
- Expired pi-owned credentials are never refreshed in the extension factory; normal-session startup resolves them through pi's lock-protected model registry before catalog refresh.
- Successful remote refresh replaces rather than merges, so account-specific additions/removals take effect.

## Preservation boundaries
Keep OAuth-session Responses routing on `cli-chat-proxy.grok.com`, API-key routing direct and explicit, Images direct, issue #65 proxy metadata/scopes intact, issue #67 state/OIDC hardening intact, and current model-specific payload/reasoning/tool compatibility intact.

## Validation evidence
Final LSP diagnostics, `npm test`, `npm run typecheck`, `git diff --check`, and 43-file npm dry-run package inspection pass. Safe authenticated GET-only smoke through the implemented selector returned two OAuth-visible Responses entries and invoked no paid API/tool. Independent correctness, security/privacy, cache, tests, docs, and package reviews completed; accepted concurrency/cancellation/cache fixes were applied and the final focused review reported `CLEAN`.

## Delivery
Reviewed implementation commit `70436d2` was pushed on `feature/issue-64-oauth-model-catalog`; unmerged PR #73 targets `main`: https://github.com/BlockedPath/pi-xai-oauth/pull/73
