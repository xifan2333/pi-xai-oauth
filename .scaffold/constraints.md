# Constraints & Safety Rules — Issue #130

## Scope

- Expand unit coverage for the existing `pi-clickable-menu:xai-tools` bridge.
- Limit changes to command tests, the bridge registration implementation when correctness requires it, and persistent state notes.

## Must

- Preserve issue #128's early `open` acknowledgement before picker closure.
- Preserve issue #129's honest `done` results for status, enable, disable, and failures.
- Isolate throwing host callbacks and avoid duplicate handling after same-API registration.
- Keep slash-command behavior and UI notifications unchanged.
- Never log raw bridge payloads, credentials, or authenticated state.

## Must not

- Work on GitHub #131 documentation or #132 built-in-tool changes.
- Change OAuth, catalog, transport, routing, or unrelated tool behavior.
- Add broad fixture behavior when the existing event bus already models the contract.
