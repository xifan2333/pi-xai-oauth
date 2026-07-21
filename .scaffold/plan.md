# Implementation Plan — Issue #129: Honest menu bridge results

**Branch:** `fix/129-menu-bridge-honest-ok`
**Base:** `origin/main`

## Goal

Make `pi-clickable-menu:xai-tools` return the actual shared command result for `status`, `enable`, and `disable`, while preserving issue #128's early `open` launch acknowledgement.

## Phases

1. [x] Map every shared-handler success and failure branch.
2. [x] Return a structured `{ ok, error? }` result while preserving slash-command notifications.
3. [x] Forward handler results through bridge `done` and add focused rejection regressions.
4. [x] Run full tests, typecheck, diagnostics, exact Pi boundaries, and independent review.

## Validation Contract

- Invalid tools, non-xAI enables, registry failures, and unavailable vision routing reply `ok: false`.
- Successful status/enable/disable requests reply `ok: true`.
- `open` still acknowledges accepted launch before picker close; post-launch picker failures remain UI-only.
- Disabling outside an xAI model preserves unrelated tool authorizations.
