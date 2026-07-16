# Constraints & Safety Rules — Issue #66

## Hard Boundaries (MUST NOT)
- Never print, log, persist outside pi auth storage, or include in errors OAuth codes, opaque device codes, access/refresh/ID tokens, PKCE verifiers, state, nonce, raw token/device responses, or authenticated headers.
- Never accept response-provided device/token endpoints, arbitrary discovery/JWKS/token URLs, arbitrary `*.x.ai` trust, raw browser codes, or callbacks without matching state.
- Never retain an unvalidated device-flow ID token or weaken browser OIDC validation.
- Never delete, revoke, migrate, or overwrite existing credentials except when pi persists a successfully completed selected login.
- Never alter credential-aware Responses routing, proxy scopes/headers, authenticated catalog exactness, or paid-tool opt-in behavior.
- Never attempt a live device flow without explicit user interaction in this pane.

## Required Practices (MUST)
- Work only on `feature/issue-66-device-code-auth` from merged main through PR #73.
- Keep browser authorization-code + PKCE first/default in pi's native selector.
- Use pinned `https://auth.x.ai/oauth2/device/code` and `https://auth.x.ai/oauth2/token`, the current public client ID, and the frozen ordered eight-scope string.
- Wait before every token poll; honor at least the server interval; add five seconds cumulatively for `slow_down`; stop at the advertised expiry capped at 15 minutes.
- Pass AbortSignal through initiation, sleeps, polling, and post-login catalog work; cancellation must return no credentials.
- Use fixed local errors and bounded JSON/schema validation.
- Keep environment detection advisory-only for selector copy; never auto-switch or reorder methods.
- Update progress after major steps and complete strict validation plus independent review before delivery.

## Live-flow Safety
A live flow, if explicitly requested during this task, must remain in this pane, show only pi's native verification URL/user code UI, invoke no paid model/tool request, never print tokens or opaque device codes, and leave existing credentials unchanged unless the complete flow succeeds.
