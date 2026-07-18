# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project shape

`pi-xai-oauth` is a TypeScript Pi extension package, not a standalone server. Pi loads `extensions/xai-oauth.ts` directly from the `pi.extensions` package manifest; there is no emitted build artifact or app to boot. `bin/setup.js` is a separate CommonJS installer that runs `pi install` and seeds Pi user settings.

Read `AGENTS.md` for the full security and compatibility invariants. For implementation work, begin with `extensions/xai-oauth.ts`, then the relevant domain module under `extensions/xai/`.

## Commands

```bash
# Reproducible dependency install (CI uses Node 24 and npm 11.6.2)
npm ci --strict-peer-deps

# Static/build gate; there is no separate build or lint command
npm run typecheck

# Compatibility policy + all Vitest suites + real Pi loader smoke
npm test

# One test file, one named test, or a named test in one file
npm run test:unit -- tests/oauth/browser-login.test.ts
npm run test:unit -- -t "rejects raw codes"
npm run test:unit -- tests/oauth/browser-login.test.ts -t "rejects raw codes"

# Development test loop and coverage
npm run test:watch
npm run test:coverage
npm run test:loader

# Package and Pi compatibility checks
npm run compatibility:check
npm run compatibility:boundaries
node scripts/run-compatibility-matrix.js X.Y.Z --candidate

# Installer CLI
npm run setup
node bin/setup.js --help
```

`npm run typecheck` is `tsc --noEmit`; strict TypeScript targets ES2022 with bundler module resolution. Vitest runs in Node with file parallelism disabled because suites mutate process/module state such as fetch, environment variables, timers, runtime models, and loopback listeners.

For dependency, compatibility, or release changes, run the broader gate documented in `CONTRIBUTING.md`: strict-unhandled-rejection tests, coverage, typecheck, compatibility checks and boundaries, `npm pack --dry-run --json`, and `git diff --check`. Do not use `--legacy-peer-deps` or `--force` for supported-version validation.

Full live use requires the external `pi` CLI, interactive xAI authentication, and a real account. For a local checkout, ensure Pi has only one copy installed to avoid fixed tool-name collisions:

```bash
pi remove npm:pi-xai-oauth && pi install .
pi
# Then run /login xai-auth in Pi.
```

## Architecture

### Runtime orchestration

`extensions/xai-oauth.ts` is the composition root. It creates OAuth and usage integrations, selects the startup catalog, registers the `xai-auth` provider and tools, and coordinates Pi lifecycle events. Session/input/model/turn hooks refresh entitlements, guard models removed from the account catalog, scope tools to the selected model, and reset optional usage state.

Catalog application has two synchronized state holders: the entrypoint's `currentModels` closure drives provider registration and lifecycle checks, while `setXaiRuntimeModels()` in `models.ts` drives request/tool guards. Update both through the existing `applyCatalog()` path.

### Authentication and catalog

- `oauth.ts` owns browser PKCE login, device-flow selection, refresh, and callback state handling.
- `device-auth.ts` owns pinned, bounded, cancellable device authorization.
- `oidc.ts` pins discovery/JWKS and validates browser ID tokens (ES256, issuer, audience, expiry, nonce).
- `auth.ts` bridges Pi-managed credentials and read-only reuse of `~/.grok/auth.json`.
- `catalog.ts` fetches and normalizes authenticated `/models-v2` entitlements and atomically stores a private, token-free cache.
- `models.ts` contains curated fallback metadata and runtime-only alias expansion.

Catalog selection is fresh cache → authenticated remote → stale cache on transient failure → curated fallback. A successful remote response, including an empty list, is exact account entitlement state. Keep alias/proven-compatible slug expansion out of the persisted cache. Refresh generations plus catalog commit guards prevent an old account's late response from overwriting a newer login.

Browser login remains PKCE S256 with matching state and nonce; manual input must be a complete matching-state callback URL, never a raw code. Endpoints are pinned. Never log or reflect authorization/device codes, tokens, PKCE verifiers, state, nonce, authenticated headers, or raw authenticated bodies.

### Responses transport

`responses.ts` is the provider's streaming adapter. It rejects unentitled models locally, routes OAuth traffic through the CLI proxy, and delegates generic serialization/SSE handling to Pi's OpenAI Responses compatibility transport. Repository-owned layers remain responsible for:

- `payload.ts`: xAI payload normalization, reasoning effort and encrypted-reasoning replay, images, cache keys, and Grok tool-name mapping.
- `routing.ts`: endpoint selection from credential provenance and request kind.
- `wire.ts`: reserved-header scrubbing, required proxy headers, redirect handling, and safe non-reflective transport errors.
- `images.ts`: vision-input normalization and compaction.

Payload hooks execute before mandatory policy is reapplied and final entitlement/modality validation runs; do not move caller hooks after those final checks. Encrypted reasoning is opaque replay state and is reusable only for the exact provider/API/model combination.

### Tools, media, and usage

There are two tool classes under `extensions/xai/tools/`:

- Grok-native local adapters use private Pi names such as `xai_grok_read_file` to avoid registry collisions. `payload.ts` exposes public names such as `read_file` only on the xAI wire and maps streamed calls back to the request-local private dispatcher. Do not register public Grok names globally.
- Network-backed custom tools are registered but disabled by default. `model-scope.ts` and `commands.ts` require explicit, session-scoped `/xai-tools` opt-in and remove them outside xAI models.

`image-edit.ts` orchestrates bounded image editing; `media/` owns containment, validation, compression, and atomic private session storage. `usage.ts` implements explicit `/xai-usage`: transient `/user` identity resolution must succeed before billing, identity is never persisted/displayed, and optional footer status is off by default and session-scoped.

### Tests and compatibility

Tests mirror domains under `tests/` (OAuth, catalog/provider lifecycle, Responses, tools, images/media, usage, and setup) and share isolated fixtures. Real callback tests must remain sequential, use real timers, and guarantee listener cleanup.

Pi compatibility is a product boundary, not only package metadata. `compatibility/pi-versions.json` is authoritative; keep both Pi peer ranges aligned and dev dependencies exact at the latest tested version. `verify-compatibility.js` checks policy/package boundaries, while `run-compatibility-matrix.js` packs the project and tests exact Pi versions in clean temporary installs so the repository lockfile cannot mask resolution failures.

## Sub-agent and workflow model selection

When launching sub-agents or workflows, always assign an explicit model based on task complexity:

- `gpt-5.6-sol` — use for difficult tasks requiring deep reasoning, such as architecture, security analysis, difficult debugging, planning, and adversarial verification. This fills the Opus role.
- `gpt-5.6-terra` — use for general software-engineering tasks, implementation, routine debugging, and code review. This fills the Sonnet role and is the default.
- `gpt-5.6-luna` — use for lightweight or mechanical tasks, such as simple searches, file discovery, formatting, and straightforward edits. This fills the Haiku role.

Do not leave the model unspecified when launching a sub-agent or workflow. If uncertain, default to `gpt-5.6-terra`; escalate to `gpt-5.6-sol` when the task requires deeper reasoning.
