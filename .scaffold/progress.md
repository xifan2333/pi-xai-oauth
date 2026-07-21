# Execution Progress — Issue #128

**Branch:** `fix/128-menu-bridge-picker-timeout`
**PR:** https://github.com/BlockedPath/pi-xai-oauth/pull/137

## Completed

- [x] Bridge `open`: ack on launch after model/UI validation; await picker without holding `done`.
- [x] Regressions: ack-before-picker-close; reject open with no xAI model.
- [x] Adopted Pi **0.81.1** as `policy.latest` after clean packed `--candidate` (unblocks CI registry gate vs 0.81.0).
- [x] `npm run compatibility:check`, `npm test` (495), `npm run typecheck` passed on tip.

## In Progress

- None.

## Delivery

- PR #137 closes #128; includes 0.81.1 boundary pin required for policy CI.
