# Shared Agent Context — Issue #131

**Issue:** <https://github.com/BlockedPath/pi-xai-oauth/issues/131>
**Branch:** `docs/131-bridge-contract`
**Base:** current `origin/main` with #128 and #129 merged

## Problem

The cross-package `pi-clickable-menu:xai-tools` event contract is informal. The listener casts raw payloads directly, then calls `.toLowerCase()` on `action` outside its protected dispatch block. A non-string action can throw before a supplied `done` callback is invoked.

## Existing behavior to preserve

- `XAI_TOOLS_MENU_CHANNEL` in `extensions/xai/tools/commands.ts` is exported and is the listener-owned channel source of truth.
- `open` reports `{ ok: true }` when the picker is accepted for launch, not when it closes.
- `status`, `enable`, and `disable` forward the shared command handler's actual success or failure.

## Approved approach

Add `docs/bridge-xai-tools.md` as protocol v1, link it from README, and state that v1 is a document/behavior revision rather than a wire `version` field. Validate raw object fields and required UI methods before dispatch. If a callable `done` is supplied, reply exactly once with a discriminated success/error result. Missing or non-callable `done` cannot be answered and must fail safely without dispatch.

## Implemented

- Production: `extensions/xai/tools/commands.ts` now validates the raw payload before dispatch and uses a once-only reply closure.
- Regressions: `tests/tools/commands.test.ts` covers non-string action/tool fields, unusable UI context, missing callable `done`, and the stable channel literal.
- Documentation: `docs/bridge-xai-tools.md`, `README.md`, and `CHANGELOG.md` define and link protocol v1.

## Validation state

`npm test`, `npm run typecheck`, and both exact packed compatibility boundaries pass. The full local suite reports 44 files and 508 tests. The package dry-run excludes `.agent-task.md`, final pi-lens session diagnostics have no blockers, and the final independent review is clean.
