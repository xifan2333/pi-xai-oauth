# Implementation Plan: GitHub Issue #52

**Branch:** feature/issue-52-xai-tools

**Date:** 2026-07-15

**Goal:** Give users a package-owned, fail-closed way to opt in to paid xAI search tools without depending on pi's optional `/tools` example extension.

## Phase 1: Reproduce and verify
- [x] Read issue #52 and confirm there are no follow-up comments.
- [x] Verify that core pi 0.80.7 does not register `/tools`; it ships only as an optional example extension.
- [x] Inspect the active-tool registry, command UI API, existing model scope, docs, and verification harness.
- [x] Run clean baseline tests and TypeScript validation.

## Phase 2: Package-owned opt-in command
- [x] Register `/xai-tools` from `pi-xai-oauth`.
- [x] Provide an interactive paid-tool picker plus explicit `enable`, `disable`, and `status` arguments.
- [x] Require an active xAI model for enablement and restrict `WebSearch` to Grok Build/Composer models.
- [x] Preserve session-start reset, non-xAI model cleanup, and fail-closed registry behavior.

## Phase 3: Documentation and verification
- [x] Replace every misleading core `/tools` reference with the package-owned command.
- [x] Add regression coverage for command registration, eligibility, toggling, lifecycle persistence, and registry failures.
- [x] Run `npm test`, `npm run typecheck`, `git diff --check`, and `npm pack --dry-run`.
- [x] Smoke-test the command through pi's real extension loader.

**Owner:** Main agent

**Next action:** Hand off the completed worktree for commit or PR publication.
