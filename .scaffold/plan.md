# Implementation Plan: Issue #69 bounded Pi peer compatibility

**Branch:** feature/issue-69-pi-peer-range
**Date:** 2026-07-17

## Goal
Publish an evidence-backed, bounded, aligned compatibility contract for `@earendil-works/pi-ai` and `@earendil-works/pi-coding-agent`, and prove both exact matrix boundaries from the packed package without reusing the repository lockfile.

## Research and Decision
- [x] Read issue #69, current merged main, package/lock/workflow/test metadata, Pi package/extension/custom-provider docs and examples, npm peer/semver guidance, and compatibility-release history.
- [x] Prove the earliest current Pi 0.80 release that passes the full packed test/typecheck suite after removing the test-only nested dependency-layout assumption.
- [x] Record the selected aligned peer range, exact matrix endpoints, and conservative next-minor upper bound.

## Implementation
- [x] Add one checked-in compatibility policy shared by metadata tests, CI matrix generation, and local validation.
- [x] Align peer, exact development, and lock metadata without widening the published support claim.
- [x] Add plain-Node policy/range/registry-drift, packed-manifest, and unsupported-peer install verification.
- [x] Add isolated packed-package matrix validation that installs and reports exact requested Pi pairs before running `npm test` and typecheck.
- [x] Add PR/main CI jobs for the exact minimum and latest allowed releases.
- [x] Document compatibility, local evaluation/widening, contribution, and release gates; update README, CHANGELOG, AGENTS, and scaffold state.

## Preservation Boundaries
- Preserve runtime behavior from issues #63-#67, including OAuth routing, proxy headers, catalog exactness, OIDC/state security, and device authorization.
- Do not migrate the test framework, implement issue #68, modernize the placeholder publish workflow, or upgrade unrelated dependencies.
- Never use `--legacy-peer-deps` or `--force` for positive compatibility validation; `--force` is permitted only in an isolated negative test proving npm emits a peer warning before runtime.

## Validation Contract
- [x] Changed-file LSP diagnostics (no errors/warnings; CommonJS/jiti hints only).
- [x] `npm test` and `npm run typecheck`.
- [x] Exact packed compatibility runs at both checked-in boundaries with requested/resolved version reporting.
- [x] Policy/range, registry drift, packed manifest, and unsupported lower/upper peer checks.
- [x] `npm pack --dry-run --json`, `git diff --check`, and workflow/schema inspection.
- [x] Independent dependency, CI, correctness, and docs reviews; accepted fixes applied and focused re-review reported CLEAN.

## Delivery
- [x] Committed reviewed changes as `4ec249e` (`fix: bound and test Pi peer compatibility`).
- [x] Pushed `feature/issue-69-pi-peer-range`.
- [x] Opened unmerged PR #77 against `main`, closing #69: https://github.com/BlockedPath/pi-xai-oauth/pull/77
