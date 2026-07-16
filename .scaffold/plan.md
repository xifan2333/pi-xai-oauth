# Implementation Plan — Issue #82 xAI usage

**Branch:** feature/issue-82-xai-usage
**Rebase baseline:** `af31e83`

## Goal

Add an explicit `/xai-usage` command and an off-by-default session status without weakening credential or privacy boundaries around the unofficial revision-pinned xAI billing surface.

## Phases

1. [x] Confirm the clean feature branch; read issue #82, provider/auth/command/event code, tests, docs, and the approved scout/architect handoff.
2. [x] Verify the exact upstream `/user` and `/billing?format=credits` contracts at `xai-org/grok-build@b189869b7755d2b482969acf6c92da3ecfeffd36`.
3. [x] Implement pinned sequential identity and billing requests with the same Pi-resolved OAuth bearer and fail closed before billing on every identity failure.
4. [x] Bound redirects, per-request timeout, response bytes, JSON complexity, array/object/history counts, IDs, timestamps, percentages, and credit values; expose only redacted errors.
5. [x] Register `/xai-usage` plus explicit `status on|off`; keep status session-only, minimum-interval event-driven, non-xAI suppressed, and cleared on model/account/session changes.
6. [x] Add observed new/legacy JSON fixtures and focused parser, transport, cancellation, redaction, command, and lifecycle tests.
7. [x] Document the unofficial revision pin, privacy boundary, command syntax, refresh policy, and limits in README, CHANGELOG, and AGENTS.
8. [x] Create `safety/issue-82-pre-main-rebase` and rebase the clean PR branch onto merged `main` after PRs #90, #91, #92, and #94.
9. [ ] Audit the automatic code merge against current wire, modality, credential, and lifecycle contracts; address findings.
10. [ ] Run focused, strict full, typecheck, coverage, package, loader, and exact Pi 0.80.1/0.80.10 boundary validation.
11. [ ] Complete independent final review, force-push with exact lease, and verify fresh PR checks without merging.

## Validation contract

- Identity lookup must succeed and yield a bounded header-safe user ID before billing is requested.
- Usage accepts only Pi-managed OAuth-session credentials; unrelated API keys and file fallbacks are excluded.
- Redirects, timeouts, bodies, JSON complexity, history, labels, timestamps, numeric ranges, and errors stay bounded.
- Identity, credentials, authenticated headers, raw bodies, and transport details are never cached, persisted, logged, displayed, or reflected.
- Optional status remains off by default, session-only, xAI-only, event-driven, and cleared on account/model/session changes.
- Current wire, catalog, image-edit, modality, OAuth, and exact Pi boundary behavior remains intact.
