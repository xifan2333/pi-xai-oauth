# Constraints & Safety Rules — Issue #78

## Hard boundaries

- One writer in this worktree; delegated reviewers are read-only.
- Preserve pinned OAuth authorize/device/token/discovery/JWKS endpoints, pinned CLI proxy Responses/catalog routes, and direct `api.x.ai` API-key/media routes.
- Never trust catalog/model/caller endpoints or route metadata.
- Keep `pi-xai-oauth` as the truthful client identifier and User-Agent; never claim to be `grok-shell`, `grok-build`, or an official Grok binary.
- Never log or reflect codes, device codes, tokens, verifiers, state, nonce, authenticated headers, raw catalog bodies, or raw transport error bodies.
- Do not invent or derive Grok agent, turn, deployment, or user IDs.
- Preserve browser PKCE/state/nonce/OIDC validation and bounded cancellable device polling.
- Do not implement encrypted reasoning in issue #78; record and defer it to #79.
- Preserve Pi peers at `>=0.80.1 <0.81.0`, minimum 0.80.1, latest 0.80.10, exact dev dependencies, and the read-only startup credential compatibility path.

## Validation

- Run focused request-shape/OAuth suites, strict full tests, coverage, loader smoke, typecheck, live policy/registry/pack checks, and exact packed 0.80.1/0.80.10 matrices.
- Resolve rebase conflicts without dropping either the issue #78 protocol contract or merged issue #93 compatibility changes.
- Commit and force-push only after independent review reports no blockers.
