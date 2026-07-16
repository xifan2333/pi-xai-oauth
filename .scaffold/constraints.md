# Constraints & Safety Rules

## Hard Boundaries (MUST NOT)
- Never commit, print, log, or include in errors API keys, OAuth codes, access/refresh/ID tokens, PKCE verifiers, state, nonce, or token response bodies.
- Never delete, revoke, overwrite, or migrate user credentials without explicit user approval.
- Never modify core pi-coding-agent internals or unrelated extensions/tools.
- Never implement issue #66's device-code selection/polling feature as part of issue #67.
- Never accept raw authorization codes or callbacks with missing/mismatched state.
- Never trust discovery, endpoints, JWT algorithms, or signing keys solely because a hostname ends in `x.ai`.

## Required Practices (MUST)
- Work on `feature/issue-67-oauth-state-oidc` from current merged `main`.
- Keep PKCE S256, state, nonce, redirect URI, discovery metadata, and callback code bound to one in-memory login transaction.
- Validate the exact first-party OIDC issuer/endpoints and retained ID-token signature, signing key, issuer, audience, expiry, and nonce before returning fresh credentials.
- Fail closed without reflecting sensitive upstream token bodies.
- Preserve existing Grok CLI credential reuse and refresh compatibility.
- Update `.scaffold/progress.md` after significant steps.
- Run LSP diagnostics, `npm test`, `npm run typecheck`, `git diff --check`, and npm package inspection before delivery.
- Use independent read-only security/correctness/test review before finalizing; keep one writer in the active worktree.

## Live-flow Safety
- Only attempt interactive OAuth when this pane can safely present the browser URL and receive user interaction.
- Do not print stored credentials or inspect credential contents during live validation.
- Do not revoke existing grants or remove credential files.
