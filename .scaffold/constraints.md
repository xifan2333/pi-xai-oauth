# Constraints & Safety Rules

## Hard Boundaries (MUST NOT)
- Never commit, cache, print, log, hash for identity, or include in errors API keys, OAuth codes, access/refresh/ID tokens, PKCE verifiers, state, nonce, or token response bodies.
- Never cache the raw `/models-v2` payload; persist normalized non-secret model definitions only.
- Never expose known API-key-only models (including `grok-build-0.1`) or entries carrying API-key/env-key/auth-scheme indicators to OAuth users.
- Never trust catalog-provided endpoints or arbitrary API backends; OAuth models stay on the pinned credential-aware CLI proxy Responses route.
- Never weaken issue #63 routing, issue #65 scopes/headers, issue #67 OAuth/OIDC state validation, existing compatibility shims, or paid-tool opt-in.
- Never delete, revoke, overwrite, or migrate user credentials.

## Required Practices (MUST)
- Work on `feature/issue-64-oauth-model-catalog` from merged PRs #70/#71/#72.
- Treat a successful authenticated catalog as exact entitlement state: additions appear and removals disappear; never merge old entries into a successful refresh.
- Use bounded startup networking, redirect refusal, defensive JSON limits, atomic cache replacement, and last-known-good writes only after full normalization succeeds.
- Distinguish authentication/permanent failures from transient network/server failures; do not use stale entitlement cache after 401/403.
- Preserve a documented small curated fallback and model-specific metadata for known models.
- Update `.scaffold/progress.md` after significant steps.
- Run LSP diagnostics, tests, typecheck, diff check, package inspection, safe GET-only live smoke, and independent review before delivery.

## Live-flow Safety
- Live validation may only GET the official pinned `/models-v2` endpoint with an existing OAuth credential loaded in-process.
- Never print request headers, credential files, token values, response identity fields, or response bodies on failure.
- Never invoke Responses, search, image generation, or any other paid tool during the catalog smoke.
