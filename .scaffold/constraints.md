# Constraints & Safety Rules — Issue #129

## Scope

- Fix truthful `done` results for the existing xAI tools menu bridge.
- Limit production changes to `extensions/xai/tools/commands.ts`; add focused tests and release/state notes.

## Must

- Preserve all existing slash-command UI notifications.
- Forward actual shared-handler outcomes for `status`, `enable`, and `disable`.
- Preserve issue #128's early `open` launch acknowledgement and exactly-once reply behavior.
- Keep non-xAI disable semantics: remove only the requested authorization and preserve others.
- Never log raw bridge payloads, credentials, or authenticated state.

## Must not

- Re-await picker close before acknowledging `open`.
- Expand into issue #130's full bridge matrix or issue #131's cross-package documentation.
- Change OAuth, catalog, transport, or unrelated tool behavior.
