# Shared Agent Context — Issue #132

**Issue:** <https://github.com/BlockedPath/pi-xai-oauth/issues/132>
**Linear:** [BLO-15](https://linear.app/blockedpath/issue/BLO-15/gh-132-support-pis-built-in-xai-supergrok-x-premium-login-for-network)
**Branch:** `feat/132-builtin-xai-tools`

## Problem

Network-tool scope and Pi-managed credential/usage lookup are hard-coded to this package's `xai-auth` provider. Pi's built-in `xai` provider now supports SuperGrok/X Premium OAuth and API keys, but installed package tools reject its active models and cannot classify its credential provenance.

## Approved Boundary

- `XAI_PROVIDER_ID = "xai-auth"` remains package ownership for registration, catalog, stream, vision routing, and automatic local Grok adapters.
- A separate `xai` ID plus a narrow compatibility predicate applies only to network tools and usage model gating.
- Managed credential search covers both providers active-first.
- Built-in OAuth uses CLI-session routes; built-in API keys use public API routes.
- Usage accepts Pi-managed OAuth only and must not fall through from an active built-in API key to another account/provider.

## Focus

- Production: `extensions/xai/constants.ts`, `extensions/xai/tools/model-scope.ts`, `extensions/xai/auth.ts`, `extensions/xai/usage.ts`.
- Regressions: tools command/lifecycle/native isolation, credentials, and usage status.
- Docs/release: `README.md`, `CHANGELOG.md`.
