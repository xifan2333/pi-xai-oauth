# Implementation Plan — Issue #130: Bridge unit coverage

**Branch:** `test/130-bridge-unit-coverage`
**Base:** `origin/main`

## Goal

Expand the `pi-clickable-menu:xai-tools` bridge regression matrix after issues #128 and #129, preserving early truthful acknowledgements and preventing repeated registration from double-handling requests.

## Phases

1. [x] Inspect the merged bridge contract, current tests, fixture event bus, and GitHub issue.
2. [x] Define focused cases for default/explicit open, status, disable, empty and invalid tools, unknown actions, throwing callbacks, and repeated registration.
3. [x] Add the regression matrix and the smallest production fix required for single-listener re-registration.
4. [x] Run focused tests, typecheck, full gates, exact Pi boundaries, diagnostics, and independent review.
5. [ ] Commit and open a PR that closes GitHub #130.

## Validation Contract

- Omitted and explicit `open` reply `{ ok: true }` before the picker closes.
- `status`, enable, and disable report their honest results and expected UI notifications.
- Empty/invalid tools and unknown actions reply `{ ok: false }`.
- A throwing `done` callback cannot escape or prevent accepted picker launch.
- Re-registering on the same ExtensionAPI replaces the prior bridge listener instead of double-handling.
- Disabling outside an xAI model preserves unrelated tool authorizations.
