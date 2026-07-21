# Constraints & Safety Rules — Issue #128

## Scope

- Fix menu-bridge `open` ack timing only (`extensions/xai/tools/commands.ts` + focused tests + CHANGELOG/scaffold).
- Do not implement #129 (honest `done.ok` for all toast-only failures), #130 (full bridge coverage), or #131 (cross-package contract docs) in this PR.

## Must

- Call `done({ ok: true })` when interactive open is accepted for launch, before awaiting picker close.
- Pre-validate active xAI model and UI before ack; reply `ok: false` when open cannot launch.
- Never re-call `done` after a successful launch ack (post-launch failures stay in-UI).
- Never log secrets, tokens, or raw bridge payloads.

## Must not

- Change slash-command `/xai-tools` interactive behavior for humans typing the command.
- Widen scope into vision routing, OAuth, catalog, or unrelated tools.
- Skip error handling on OAuth refresh (N/A here; do not regress elsewhere).
