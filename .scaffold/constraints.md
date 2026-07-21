# Constraints & Safety Rules — Issue #131

## Scope

- Document the listener-owned `pi-clickable-menu:xai-tools` protocol as v1.
- Apply only the small malformed-payload hardening requested by #131.
- Add focused tests, README linkage, release notes, and state updates.

## Must

- Keep `XAI_TOOLS_MENU_CHANNEL` as the single production source of truth.
- Preserve issue #128's early `open` launch acknowledgement.
- Preserve issue #129's honest `status`, `enable`, and `disable` outcomes.
- Validate raw action, tool, context/UI, and callback fields before command dispatch.
- Call a supplied callable `done` exactly once for every accepted or rejected request.
- Keep errors bounded to safe human-readable messages; never reflect raw payloads or context.

## Must not

- Add a separate shared-type package or require a new wire-version field.
- Re-await picker close before acknowledging `open`.
- Expand bridge behavior/coverage into issue #130 or built-in tool work in #132.
- Change OAuth, catalog, transport, or unrelated tool behavior.
