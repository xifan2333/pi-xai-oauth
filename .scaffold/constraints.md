# Constraints & Safety Rules — Issue #82

## Identity and credentials

- Resolve the OAuth bearer through Pi's existing credential path; never accept API-key provenance for this surface.
- Obtain `x-userid` only from pinned authenticated `GET https://cli-chat-proxy.grok.com/v1/user`.
- Keep identity transient within one fetch call. Never persist, cache, log, display, fingerprint, or copy it into catalog/auth state.
- On any identity transport, auth, redirect, timeout, cancellation, byte, JSON, shape, or validation failure, stop before billing.
- Never log or reflect bearer tokens, authenticated headers, user identity, raw bodies, or transport exception details.

## Billing and parsing

- Pin `GET https://cli-chat-proxy.grok.com/v1/billing?format=credits`; never accept a caller/catalog endpoint.
- Reject redirects; use a 15-second per-request timeout and 64 KiB response limit.
- Bound JSON depth, node count, array size, object keys, history periods, user ID, labels, timestamps, percentages, billing cycles, and cent values.
- Treat config fields as optional. Support only observed new fields and documented legacy fallbacks.
- Billing errors and optional status must never affect chat.

## Status lifecycle

- One-shot `/xai-usage` is explicit and does not enable status.
- Status is off by default and requires `/xai-usage status on` with an active `xai-auth` model.
- Status is in-memory/session-only, refreshes only after completed turns, and never more often than once per minute.
- Clear and disable status on model, provider, account, session start/shutdown, and non-xAI context changes.

## Delivery

- Keep implementation changes in the isolated issue-82 worktree; delegated audits are read-only.
- Preserve `safety/issue-82-pre-main-rebase` and use exact force-with-lease against the known old remote head.
- Use locked npm dependencies; use UV instead of pip if Python becomes necessary.
- Preserve merged wire, modality, image-edit, catalog, OAuth, and Pi 0.80.1/0.80.10 compatibility behavior.
- Update scaffold after major phases. Push only after full validation and independent review; do not merge PR #89.
