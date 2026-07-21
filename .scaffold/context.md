# Shared Agent Context — Issue #130

**Issue:** <https://github.com/BlockedPath/pi-xai-oauth/issues/130>
**Linear:** [BLO-13](https://linear.app/blockedpath/issue/BLO-13/gh-130-expand-bridge-unit-coverage-openstatusdisableinvalid-tooldouble)
**Series:** BLO-10 / GitHub #128–#131
**Branch:** `test/130-bridge-unit-coverage`

## Problem

The bridge contract fixes are merged, but success/default/error and callback-lifecycle branches remain incompletely covered. Repeated `registerXaiToolsCommand` calls also retain the old event listener and can double-handle one request.

## Approach

Add focused bridge tests for omitted/explicit open, status, disable, empty and invalid tools, unknown action, callback throw isolation, and repeated registration. Preserve issue #128's early open acknowledgement and issue #129's honest result forwarding; replace any prior same-API bridge listener during re-registration.

## Focus

- Production: `extensions/xai/tools/commands.ts` only if required for repeated-registration correctness
- Regressions: `tests/tools/commands.test.ts`
- Fixture: `tests/fixtures/extension-api.ts` only if existing multi-listener support proves insufficient
