# Execution Progress — Issue #82

**Branch:** feature/issue-82-xai-usage
**Current baseline:** `af31e83`

## Completed

- [x] Confirmed the branch was clean and based on `origin/main`; installed locked dependencies with `npm ci`.
- [x] Read issue #82 and the relevant provider, credential, command, event, fixture, test, documentation, and package-boundary code.
- [x] Verified upstream billing and `/user` identity behavior at the exact issue revision.
- [x] Added the pinned identity-first usage transport with OAuth-only provenance, required proxy metadata, fail-closed sequencing, redirect rejection, cancellation, safe errors, and no identity/raw-body retention.
- [x] Added bounded new/legacy usage parsing and conservative command/footer renderers.
- [x] Registered `/xai-usage` with one-shot display plus explicit `status on|off`; status is session-scoped, rate-bounded, event-driven, non-xAI suppressed, and reset on model/account/session changes.
- [x] Added three JSON fixtures and focused parser, transport, timeout, cancellation, redaction, command, status, and provider-registration coverage.
- [x] Updated README, CHANGELOG, AGENTS, and all issue scaffold files.
- [x] Tightened usage credential resolution to pi's managed xAI model registry only and added a regression proving an unrelated active-model API key is never sent to xAI.
- [x] Confirmed PR #89 has no reviews or review threads; its comments are bot usage-limit notices.
- [x] Confirmed the old policy failure was obsolete Pi 0.80.7 registry drift already fixed by merged PR #94.
- [x] Preserved the original reviewed implementation/docs commits (`d7ccd17`, `53b8013`) and open PR #89 on `safety/issue-82-pre-main-rebase`.
- [x] Fetched `origin/main=af31e83`, verified the worktree was clean at remote head `53b8013`, and created `safety/issue-82-pre-main-rebase`.
- [x] Started the semantic rebase onto current merged main while preserving #90/#91/#92/#94 behavior.
- [x] Completed the rebase as `9792282` plus `4c0f098` with no unresolved markers or diff-check errors.
- [x] Centralized the exact usage proxy-header contract in `wire.ts`.
- [x] Bounded stalled response bodies with explicit abort races and deterministic cancellation/timeout coverage.
- [x] Required the Pi-resolved bearer to match the current stored OAuth access token after refresh, rejecting stored and runtime API-key provenance.
- [x] Detached cosmetic status refresh from Pi's awaited `turn_end` path, made calendar timestamp validation strict, and cancelled non-success bodies.
- [x] Reserved `x-userid` across shared wire scrubbing and documented its single transient billing-only exception.
- [x] Aborted/suppressed stale one-shot and footer completions on reset; stored OAuth removal now disables status before throttling.
- [x] Added actual provider lifecycle, file-fallback rejection, parser node/key/timestamp, invalid UTF-8, loader-command, and pack-production regressions.
- [x] Passed the post-finding focused usage/provider/wire suites (7 files / 74 tests), strict TypeScript, real loader, direct pack contract, and diff check.
- [x] Passed the final cumulative gate: `npm test` (37 files / 398 tests), strict TypeScript, real loader, coverage, policy, 111-file pack contract, and exact Pi 0.80.1/0.80.10 boundaries.
- [x] Measured final V8 coverage at 86.03% statements, 79.27% branches, 86.09% functions, and 89.88% lines.
- [x] Passed independent security re-review of OAuth removal, stale one-shot suppression, billing-only identity handling, and caller `x-userid` scrubbing.
- [x] Passed independent final test review after adding real exact-boundary registry coverage, version-adaptive strict OAuth provenance, non-blocking hostile-stream cancellation, and a due/stalled turn lifecycle regression.

## In progress

- [ ] Force-push with exact lease, refresh PR #89 if needed, and verify fresh checks without merging.

## Residual

- No live xAI request or interactive OAuth flow is part of this offline gate.
- The usage API is unofficial and revision-pinned; upstream drift requires deliberate review.
