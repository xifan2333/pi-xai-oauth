# Changelog

All notable user-facing changes to `pi-xai-oauth` are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and version numbers follow [Semantic Versioning](https://semver.org/).

Dates below are npm publication dates. The earliest rapid-release series is grouped where the repository did not preserve reliable per-version release notes.

## Unreleased

### Added

- Added 246 focused typed Vitest regressions across provider/catalog routing, browser/device OAuth and OIDC, Responses payloads/streams/errors, images, network-tool lifecycle, custom tools, Cursor shims, and setup/settings.
- Added a small real Pi extension-loader smoke plus V8 text/JSON/LCOV coverage with measured regression floors.
- Added a browser-first native login-method selector with device authorization for SSH, WSL, containers, remote workspaces/VMs, and human-operated headless sessions.
- Added pinned, bounded, cancellable RFC 8628 polling with initial wait, server interval plus cumulative `slow_down`, denial/expiry handling, strict secret-safe schema validation, and deterministic timing tests.
- Added authenticated OAuth-visible model discovery from the official CLI proxy `/models-v2` endpoint.
- Added defensive model normalization plus an atomic, token-free last-known-good cache with a 15-minute fresh TTL, a 5-second bounded refresh, and a 7-day stale-if-transient window.
- Added fixture-based coverage for catalog additions, removals, empty entitlements, malformed entries, API-key-only filtering, cache freshness, auth/network failures, and curated fallback selection.
- Added packed-package compatibility validation at exact Pi 0.80.1 and 0.80.10 boundaries, with requested/resolved version reporting, range and registry-drift checks, packed-manifest inspection, and unsupported-peer install diagnostics.
- Added PR/main CI that derives its exact compatibility matrix from the checked-in Pi version policy instead of reusing the development lockfile version.

### Changed

- Replaced the shared-state monolithic behavior verifiers with isolated per-domain suites and closure-local fixtures; production runtime behavior is unchanged.
- Made the repository CI job run the full unit suite once under coverage and the loader smoke separately; packed compatibility jobs rerun unit, loader, and TypeScript checks at each exact Pi boundary.
- Centralized xAI endpoint selection around explicit OAuth-session versus API-key credential provenance instead of model IDs.
- Kept Grok Build and Composer payload, header, and tool compatibility separate from transport routing.
- Updated fresh OAuth logins to request xAI's current eight-scope Grok client grant, including conversation read/write access, while leaving existing refresh grants compatible.
- Derived the proxy client identifier and version from this package's own metadata instead of impersonating a stale Grok CLI release.
- Made the authenticated account catalog authoritative for OAuth model additions and removals; known static metadata now enriches returned IDs without advertising unreturned models.
- Made successful login force-refresh and immediately replace the model catalog, while `/reload` follows the documented cache TTL.
- Kept browser authorization-code + PKCE as the desktop default while recommending device login in remote/headless selector copy without automatically changing the selected method.
- Replaced wildcard Pi peers with the aligned, bounded `>=0.80.1 <0.81.0` range and pinned development metadata exactly to the latest tested boundary, 0.80.10.
- Reviewed Pi 0.80.8 through 0.80.10 and adopted 0.80.10 after clean packed candidate validation, while preserving the 0.80.1 minimum and existing peer range.
- Documented the deliberate candidate-test and review process required before widening support to another pre-1.0 Pi line.

### Fixed

- Kept startup credential discovery compatible with Pi 0.80.1 and Pi 0.80.10 by using the new read-only `readStoredCredential()` API when available and a synchronous JSON-only fallback on older supported hosts, without creating credential storage.
- Migrated the real Pi credential-persistence integration test to exercise `ModelRuntime` and `InMemoryCredentialStore` on current Pi while retaining the legacy boundary path.
- Removed the unbound raw authorization-code fallback; pasted browser completions require matching OAuth state, and raw-code users are directed to device login or a complete state-bound redirect URL.
- Pinned xAI OIDC discovery and JWKS policy and validated fresh-login ID-token ES256 signatures, signing keys, issuer, audience, expiry, and nonce before retaining credentials.
- Stopped reflecting xAI token endpoint response bodies in authentication errors.
- Routed normal streaming and separate Responses helpers for every `xai-auth` model through the official Grok CLI session-token proxy, matching the intended OAuth/session-token transport contract for Responses traffic.
- Preserved the official direct `api.x.ai` Images endpoint for OAuth-backed image generation while keeping a future explicit API-key Responses route on the public API.
- Added the complete CLI-proxy authentication, client-mode, request, conversation, session, and model metadata to every OAuth Responses request, with required values protected from caller overrides.
- Filtered hidden, malformed, unsupported-backend, secret-bearing, and known API-key-only entries such as `grok-build-0.1` from the OAuth provider catalog.
- Invalidated stale entitlement data after authentication/permanent failures and prevented a forced post-login refresh from reusing another account's stale cache.
- Prevented device authorization failures, denial, expiry, cancellation, malformed data, and missing access/refresh tokens from returning or replacing credentials; device ID tokens are not retained without browser nonce validation.

## 1.3.5 - 2026-07-15

### Changed

- Replaced the repeated `/xai-tools` TUI selector with one persistent picker.
- Added arrow and page navigation, Enter or Space toggling, and Escape-to-close controls without rebuilding the list.
- Updated TypeScript and Node.js development type dependencies.

### Fixed

- Preserved the highlighted tool and scroll position after enabling or disabling a tool.
- Kept the existing selector behavior for RPC clients.
- Tightened npm package exclusions for local development artifacts.

## 1.3.4 - 2026-07-15

### Added

- Added the package-owned `/xai-tools` command with an interactive picker plus `status`, `enable`, and `disable` arguments.
- Added category and cost-risk context for all network-backed xAI tools:
  - `xai_generate_text`
  - `xai_web_search`
  - `xai_x_search`
  - `xai_multi_agent`
  - `xai_deep_research`
  - `xai_code_execution`
  - `xai_generate_image`
  - `xai_analyze_image`
  - `xai_critique`
  - `WebSearch` for Grok Build and Composer models

### Changed

- Made every helper that sends an additional xAI request inactive by default and explicitly opt-in for the current session.
- Kept local filesystem and shell compatibility shims automatic for eligible Grok Build and Composer models because they do not make additional xAI requests.
- Reset outbound-tool activation at session start and when switching away from eligible xAI models.

### Fixed

- Isolated the xAI Responses transport from unsupported root-module assumptions.
- Blocked disabled tools before OAuth credential resolution or network access.
- Made tool-registry failures fail closed and prevented stale activation from bypassing explicit authorization.
- Fixed paid web, X, multi-agent, deep-research, and `WebSearch` gating.
- Fixed repeated screenshot and image replay in long Responses conversations.
- Added consumed-image cleanup, safe image compaction, and a 3 MiB aggregate inline-image transport budget with clear local failures.
- Normalized multimodal Responses payloads, image-bearing tool results, and active-model routing.

## 1.3.3 - 2026-07-11

### Fixed

- Routed xAI Responses streaming through pi-ai's compatibility dispatcher so pi 0.80's extension loader no longer rewrites a subpath into an invalid module path.

## 1.3.2 - 2026-07-11

### Fixed

- Added initial compatibility with the pi-ai 0.80 Responses API.
- Scoped Cursor/Grok CLI compatibility shims to eligible models so they no longer leaked into normal Grok requests.

## 1.3.1 - 2026-07-09

### Fixed

- Improved setup cleanup so duplicate local and npm installations are detected and pruned instead of causing tool-name conflicts.

## 1.3.0 - 2026-07-08

### Added

- Added Grok 4.5 with text and image input, a 500K context window, and `low`, `medium`, and `high` reasoning levels.
- Added Grok 4.5 fast mode through `low` reasoning effort on the same model ID.

### Changed

- Made Grok 4.5 the default model across provider registration, setup, and documentation.
- Added stable Responses cache and conversation identifiers for more reliable multi-turn cache reuse.
- Hardened Grep argument normalization and missing-pattern errors for Grok CLI compatibility.

## 1.2.6 - 2026-07-07

### Fixed

- Corrected xAI image-generation request parameters and rejected the unsupported `size` option locally.
- Preserved support for generating one to four images with the active xAI image model.

## 1.2.5 - 2026-06-20

### Fixed

- Refreshed the npm compatibility guidance and Node.js development type dependency.

## 1.2.4 - 2026-06-20

### Fixed

- Added the xAI API guard delegate required by pi 0.79.8+ for OpenAI Responses streaming.
- Added direct verification against pi 0.79's guarded provider path.
- Hardened OAuth wrong-state verification timeout behavior.
- Resolved repository CodeQL findings.
- Excluded agent worktrees from npm packages.

## 1.2.3 - 2026-06-04

### Fixed

- Corrected manual OAuth callback-code parsing.

## 1.2.2 - 2026-06-04

### Added

- Added Grok Build and Composer 2.5 Fast through the Grok CLI OAuth endpoint.
- Added Grok 4.20 reasoning, non-reasoning, and multi-agent model variants.
- Added Cursor/Grok CLI compatibility shims for filesystem, search, shell, todo, and native `WebSearch` tool calls.

### Changed

- Split the original monolithic extension into focused OAuth, authentication, model, payload, Responses, and tool modules.

### Fixed

- Repaired xAI OAuth provider registration, token reuse and refresh, Responses streaming, payload normalization, and custom-tool integration.
- Added automated extension verification for provider, model, tool, authentication, and streaming behavior.

## 1.2.1 - 2026-05-17

- Republished the same Git revision as 1.2.0. The repository records no source difference between these two npm versions.

## 1.2.0 - 2026-05-17

- Short-lived publishing transition superseded by 1.2.1. The npm package metadata points to the same Git revision for both versions.

## Initial series - 2026-05-16 to 2026-05-17

### 1.0.25-1.0.26

- Added OAuth-first image generation, image analysis, critique, and deep-research tools.
- Added advanced X-search filters and moved remaining custom tools to shared OAuth token resolution.
- Added provider payload sanitization, repository security policy, contribution templates, and agent scaffolding support.
- Removed an erroneous package self-dependency and cleaned npm package contents.

### 1.0.19-1.0.22

- Added the one-command installer and automatic settings configuration.
- Fixed browser-based OAuth launch and duplicate authorization URLs.
- Improved native web and X search prompting and added multimodal image input support.
- Fixed xAI image Responses payload serialization.

### 1.0.12-1.0.17

- Reworked the extension structure, completed the OAuth flow, improved tool registration, and added automatic browser opening.
- Added clean npm packaging and the first setup experience.

### 1.0.1-1.0.9

- Added Responses API transport, reuse of `~/.grok/auth.json`, device-code authentication, and refresh-token support.
- Added text generation, multi-agent research, web search, X search, and code-execution tools.
- Added initial agentic model-change behavior and expanded usage documentation.

### 0.1.0

- Initial npm release with the `xai-auth` OAuth provider, Grok 4.3, and configurable thinking levels.
