# Shared Agent Context — Issue #129

**Issue:** <https://github.com/BlockedPath/pi-xai-oauth/issues/129>
**Linear:** [BLO-12](https://linear.app/blockedpath/issue/BLO-12/gh-129-menu-bridge-replies-oktrue-even-when-handlexaitoolsargs)
**Series:** BLO-10 / GitHub #128–#131
**Branch:** `fix/129-menu-bridge-honest-ok`

## Problem

`handleXaiToolsArgs` reported ordinary rejections only through `ctx.ui.notify` and returned `void`. The menu bridge therefore replied `{ ok: true }` after invalid tools, non-xAI enables, registry failures, or unavailable vision routing.

## Fix

Return a small shared command result and pass it unchanged to bridge `done` for `status`, `enable`, and `disable`. Keep slash-command notifications and issue #128's prevalidated, early `open` acknowledgement unchanged.

## Focus

- Production: `extensions/xai/tools/commands.ts`
- Regressions: `tests/tools/commands.test.ts`
- Release note: `CHANGELOG.md`
