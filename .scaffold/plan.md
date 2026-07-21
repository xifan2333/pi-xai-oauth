# Implementation Plan — Issue #128: Menu bridge open ack before picker close

**Branch:** `fix/128-menu-bridge-picker-timeout`
**Base:** `origin/main`

## Goal

Stop the `pi-clickable-menu:xai-tools` bridge from awaiting interactive picker close before `done({ ok: true })`, which false-triggers the menu host’s ~4s timeout.

## Phases

1. [x] Confirm issue scope (#128 only; #129–#131 follow in series order).
2. [x] Ack `open` on launch after pre-validation (active xAI model + UI), then await picker without holding `done`.
3. [x] Add regression: `done` resolves while a held picker is still open; reject open with no model.
4. [x] CHANGELOG + focused Vitest for `tests/tools/commands.test.ts`.

## Validation Contract

- `action: "open"` calls `done` when the picker is accepted for launch, not after close.
- Missing xAI model / missing UI still reply failure before any interactive wait.
- Post-launch picker errors notify in-UI only (do not re-call `done`).
- Focused tools command tests pass.
