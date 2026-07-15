# Implementation Plan: GitHub Issues #49 and #50

**Branch:** feature/issues-49-50

**Date:** 2026-07-15

**Goal:** Prevent unintended xAI paid-search calls and keep stateless Responses requests below the xAI OAuth gateway's unreliable inline-image payload range.

## Phase 1: Issue review and baseline
- [x] Read issues #49 and #50 and their comments through GitHub.
- [x] Inspect the provider entrypoint, custom tool registration, payload normalization, Responses transport, setup script, tests, README, and pi extension contracts.
- [x] Move the existing worktree from the obsolete merged branch to `feature/issues-49-50` at current `origin/main`.
- [x] Run baseline `npm test` and `npm run typecheck`.

## Phase 2: Issue #49 paid-search guard
- [x] Keep xAI search/research tools registered but inactive by default.
- [x] Remove those tools immediately when the active model is not from `xai-auth`.
- [x] Fail tool execution locally before auth/network resolution unless an active xAI model is present.
- [x] Route web/X/deep-research requests through the active xAI model instead of `DEFAULT_XAI_MODEL`.
- [x] Add regression coverage for default inactivity, model switching, local no-request rejection, active-model routing, and zero requests from lifecycle events.

## Phase 3: Issue #50 image lifecycle and transport mitigation
- [x] Omit consumed historical tool-result image binaries after a later assistant response while retaining explicit text markers.
- [x] Preserve unconsumed tool-result images until the first assistant response.
- [x] Compact oversized inline PNG/JPEG images with high-fidelity JPEG encoding before transport and enforce an aggregate inline-image budget.
- [x] Normalize delegated transport error prefixes from OpenAI to xAI.
- [x] Add regression coverage for image lifecycle, compaction, dimensions, payload budget, and clear no-network overflow failure.

## Phase 4: Verification and review
- [x] Run focused tests, `npm test`, `npm run typecheck`, `git diff --check`, and `npm pack --dry-run`.
- [x] Run an independent reviewer agent against the final diff.
- [x] Address all valid findings and re-run validation.

**Owner:** Main agent

**Research:** Parallel issue #49 and issue #50 subagents

**Next action:** Hand off the completed worktree for commit or PR publication.
