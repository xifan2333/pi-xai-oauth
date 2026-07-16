# Shared Agent Context — Issue #68

**Branch:** feature/issue-68-vitest-suites
**Issue:** https://github.com/BlockedPath/pi-xai-oauth/issues/68

## Baseline

Current `main` has a 2,622-line `scripts/verify-extension.js` plus device, catalog, setup, compatibility, and packed-matrix Node verifiers. Strict baseline tests and TypeScript pass. The direct `assert.*` inventory is 549 calls across all verifier/matrix scripts.

## Evidence

- Full destination map: `docs/testing/assertion-parity.md`
- Delegated issue/Vitest research: `.pi-subagents/artifacts/outputs/8164762c-6f0c-4034-a868-6e3680f458d4/research/issue-vitest.md`
- Assertion inventory: `.pi-subagents/artifacts/outputs/8164762c-6f0c-4034-a868-6e3680f458d4/research/assertion-inventory.md`
- Implementation context: `.pi-subagents/artifacts/outputs/8164762c-6f0c-4034-a868-6e3680f458d4/research/implementation-context.md`

## Decisions

- Use exact matching Vitest and `@vitest/coverage-v8` releases supported by Node 24.
- Keep explicit Vitest imports and a Node environment.
- Typecheck test/config/fixture TypeScript separately from runtime execution.
- Keep package/policy/registry/resolver/matrix checks as Node scripts.
- Use focused Vitest behavior suites plus `scripts/verify-extension-loader.mjs`, which resolves Pi's ESM main then imports its real `dist/core/extensions/loader.js` by file URL on both supported boundaries.
- Final measured V8 baseline is 83.37 statements / 75.01 branches / 85.79 functions / 86.93 lines; configured floors are 82/74/84/85.
- Vitest disables file parallelism for real callback reliability and globally masks inherited `PI_CODING_AGENT_DIR`; the loader smoke also owns/restores its agent directory.

## Main risks

Global fetch/timers/HOME/cwd, loopback callback ports, mutable runtime models, tool WeakMap/WeakSet state, response transport captured at import time, cache write queues, and real image codec behavior are isolated by the suite. Pi 0.80.8 is newly published inside the allowed range; the intentionally unchanged 0.80.1/0.80.7 policy now triggers the external registry-drift gate pending a separate compatibility review.

## Delivery

Reviewed implementation commit `7adfb88` was pushed on `feature/issue-68-vitest-suites`; unmerged PR #87 targets `main` and closes issue #68: https://github.com/BlockedPath/pi-xai-oauth/pull/87
