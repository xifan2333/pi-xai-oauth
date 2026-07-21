# Implementation Plan — Issue #131: xAI tools bridge contract

**Branch:** `docs/131-bridge-contract`
**Base:** `origin/main`

## Goal

Publish the listener-owned v1 contract for `pi-clickable-menu:xai-tools` and close the malformed-payload gap without expanding into issues #130 or #132.

## Phases

1. [x] Inspect issue #131, the listener, peer emitter, focused tests, and existing #128/#129 behavior.
2. [x] Add a versioned bridge document and link it from the `/xai-tools` README section.
3. [x] Validate raw request fields before dispatch and reply exactly once to malformed requests that provide a callable `done`.
4. [x] Add focused malformed-payload regressions and update release notes/state.
5. [x] Run focused tests, typecheck, full gates, exact compatibility boundaries, and independent review.
6. [x] Commit, push, and open a PR that closes #131.

## Validation Contract

- `XAI_TOOLS_MENU_CHANNEL` remains the listener-owned source of truth.
- Protocol v1 documents `action`, `tool`, `ctx`, and `done` without adding a wire-version field.
- Non-string actions/tools and unusable contexts are rejected before dispatch; a callable `done` receives one `{ ok: false, error }` result.
- `status`, `enable`, and `disable` return the shared handler's honest result.
- `open` acknowledges accepted picker launch before picker close, with post-launch failures remaining UI-only.
