# AGENTS.md — AI Agent Operations Manual for pi-xai-oauth

> **For AI coding agents only.** Keep this file machine-readable and concise. Human-facing docs live in README.md.

## Project Overview
pi-xai-oauth is a pi-package that registers the xAI OAuth provider (`xai-auth`) and the authenticated account's OAuth-visible Grok model catalog for the pi coding agent framework, with Grok 4.5 as the curated offline fallback.

Core flow: `bin/setup.js` → `pi install` → bounded catalog selection in `extensions/xai/catalog.ts` → provider registration in `extensions/xai-oauth.ts` → OAuth PKCE transaction in `extensions/xai/oauth.ts` → pinned OIDC/JWKS validation in `extensions/xai/oidc.ts` → streaming via xAI API helpers in `extensions/xai/responses.ts`.

## Key Commands (Exact, Copy-Paste Ready)
- Install / setup: `node bin/setup.js` or `npm run setup` (if added)
- Install as pi extension: `pi install npm:pi-xai-oauth`
- Run TypeScript: `npx tsc --noEmit` (validate)
- Git: Always work on feature branches. Current branch for this work: `feature/issue-64-oauth-model-catalog`

## Architecture & Boundaries (MUST / MUST NOT)
**MUST:**
- Register providers via `pi.registerProvider("xai-auth", { ... })`
- Use PKCE S256 OAuth flow with local callback server
- Require matching state for every HTTP or pasted authorization callback before token exchange
- Validate retained fresh-login ID tokens against pinned first-party discovery/JWKS, ES256, issuer, audience, expiry, and nonce
- Support reasoning levels: none / low / medium / high
- Reuse `~/.grok/auth.json` when possible without deleting or revoking it
- Fetch OAuth-visible models only from the pinned authenticated CLI proxy `/models-v2` endpoint
- Treat successful catalog responses as exact entitlement state; additions appear and removals disappear
- Keep the normalized token-free catalog cache atomic and apply the documented TTL/stale/fallback policy
- Preserve known model metadata and compatibility behavior without advertising models absent from the authenticated catalog

**MUST NOT:**
- Hardcode API keys (use OAuth only)
- Accept raw authorization codes or callbacks with missing/mismatched state
- Trust arbitrary `*.x.ai` discovery, token, or JWKS endpoints
- Log or reflect authorization codes, tokens, PKCE verifiers, state, nonce, token response bodies, or authenticated request headers
- Cache raw `/models-v2` responses, credentials, identity fields, endpoint URLs, or known API-key-only models
- Trust catalog-provided endpoints or route non-Responses models through the OAuth provider
- Delete or revoke existing user credentials during validation
- Modify core pi-coding-agent internals
- Touch unrelated extensions or skills
- Skip error handling on OAuth refresh

## File Structure & Wayfinding
```
pi-xai-oauth/
├── bin/
│   └── setup.js          # One-command installer + settings seeder
├── extensions/
│   ├── xai-oauth.ts      # Thin entrypoint: provider registration + tool orchestration
│   └── xai/              # Focused implementation modules
│       ├── catalog.ts    # Authenticated catalog normalization + atomic token-free cache
│       ├── constants.ts  # URLs, defaults, OAuth/catalog constants
│       ├── models.ts     # Curated fallback/known metadata + compatibility helpers
│       ├── oauth.ts      # OAuth login/refresh/callback transaction helpers
│       ├── oidc.ts       # Pinned discovery/JWKS + ID-token validation
│       ├── auth.ts       # Credential reuse + token resolution helpers
│       ├── payload.ts    # Responses payload normalization
│       ├── responses.ts  # xAI request/stream helpers
│       ├── routing.ts    # Credential-aware Responses/Images endpoint routing
│       └── tools/        # Custom xAI tools + Cursor/Grok CLI shims
├── package.json
├── tsconfig.json
├── README.md
├── AGENTS.md             # This file
└── .scaffold/            # Persistent agent state (auto-generated on init)
    ├── plan.md
    ├── constraints.md
    ├── progress.md
    ├── context.md
    └── (custom overrides here)
```

Start any task by reading:
1. `extensions/xai-oauth.ts` (provider entrypoint)
2. Relevant `extensions/xai/` domain module for the task
3. `bin/setup.js`
4. This AGENTS.md

## Style & Quality Rules
- Use TypeScript strict mode
- Prefer async/await for OAuth and API calls
- Add JSDoc for all exported functions
- Keep OAuth callback server minimal and secure
- Treat raw-code/device-code migration as separate from issue #66's full device authorization implementation
- Never log OAuth codes, tokens, token response bodies, verifiers, state, nonce, catalog request headers, or raw authenticated catalog bodies
- Reject malformed, hidden, unsupported-backend, secret-bearing, and known API-key-only catalog entries
- Keep startup catalog network behavior bounded and use pi's credential lock for expired stored-token refresh

## Safety Gates
- Before any file edit: run `git status` and confirm on correct branch
- Before committing: ensure `npx tsc --noEmit` passes
- For multi-agent work: always use the subagent tool with explicit parallel or chain mode
- External state lives in `.scaffold/` — update progress.md after every major step

## Multi-Agent Workflow (Preferred)
When complex work is needed:
1. Use `subagent` in PARALLEL mode for research + planning
2. Delegate to specialized agents (researcher, planner, reviewer, worker)
3. Save outputs to `.scaffold/` files
4. Review with `reviewer` agent before implementation

## Persistent State (Use These Files)
- `.scaffold/plan.md` — Current implementation plan with steps and owners
- `.scaffold/constraints.md` — Hard rules and boundaries
- `.scaffold/progress.md` — What has been done + next actions
- `.scaffold/context.md` — Shared context for handoff between agents

## Next Steps When Starting Fresh
1. Read this AGENTS.md + README.md
2. Run `git checkout -b feature/your-task`
3. Check `.scaffold/plan.md` for current work
4. Use parallel subagents for heavy lifting

This file should be updated whenever architecture, commands, or rules change.
