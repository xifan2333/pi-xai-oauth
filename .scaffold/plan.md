# Implementation Plan — Issue #132: Built-in xAI network tools

**Branch:** `feat/132-builtin-xai-tools`
**Issue:** https://github.com/BlockedPath/pi-xai-oauth/issues/132
**Linear:** BLO-15

## Goal

Support Pi's built-in `xai` SuperGrok/X Premium credentials for opt-in network tools and subscription usage without taking over Pi's built-in chat, catalog, stream, vision routing, or package-owned local Grok adapters.

## Phases

1. [x] Read the task, GitHub/Linear context, required entrypoints, auth/tool/usage modules, tests, and Pi 0.81.1 provider/runtime behavior.
2. [x] Add the narrow `xai-auth`/`xai` network-tool provider boundary.
3. [x] Resolve both providers active-first with OAuth/API-key provenance and strict usage rejection.
4. [x] Add network lifecycle, command, credential, usage, and non-takeover regressions.
5. [x] Update README/changelog and persistent state.
6. [ ] Run diagnostics, focused/full tests, typecheck, exact Pi boundaries, and independent review.
7. [ ] Commit, push, open a PR closing #132, and update BLO-15.

## Validation Contract

- Active `xai/grok-*` models can opt into and execute network-backed tools.
- Built-in OAuth resolves as `oauth-session`; built-in API keys resolve as `api-key`.
- Usage accepts Pi-managed OAuth only and rejects an active built-in API-key credential.
- Switching to a non-xAI provider clears network opt-ins.
- `xai-auth` remains the only package-registered/catalog/stream provider.
- Automatic local Grok adapters and vision routing remain `xai-auth`-only.
