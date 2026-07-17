# Constraints & Safety Rules — Issue #80

## Catalog and cache

- Preserve authenticated `/models-v2` as exact entitlement membership; capability enrichment must never union or remove IDs.
- Parse only exact `acceptsImages` booleans and bounded `inputModalities` arrays from an entry or `_meta`.
- Precedence is `entry.acceptsImages`, `_meta.acceptsImages`, `entry.inputModalities`, `_meta.inputModalities`, known metadata, then conservative unknown text.
- Malformed higher-priority evidence falls through; it does not exclude the entitlement or become an authenticated denial.
- Do not mark Composer text-only without authenticated or official evidence.
- Schema-1 migration is in-memory and never labels legacy input as authenticated. Preserve membership, order, IDs, and normalized non-input metadata.
- Store only normalized models, timestamps, and bounded provenance. Never cache raw catalog bodies, tokens, headers, endpoints, or identity fields.
- Preserve atomic writes, TTL, stale-if-transient behavior, invalidation, permissions, cancellation, refresh ownership, and centralized catalog wire headers.

## Transport and OAuth

- Keep existing unentitled-model rejection and evaluate image capability from the current runtime entitlement snapshot at the final pre-network point.
- Run the image guard after package rewriting, caller payload hooks, and image compaction; zero fetches may occur on rejection.
- Error text may identify the model but must not echo payloads, image locations/data, credentials, headers, or raw upstream bodies.
- Central direct-helper enforcement must cover `xai_generate_text(image_url)` and `xai_analyze_image`; do not apply image-input policy to image generation.
- Preserve pinned routes, centralized truthful wire headers, reserved-header scrubbing, redirect rejection, and suppression of generic delegate affinity IDs.
- Preserve browser PKCE/state/nonce/OIDC validation, bounded cancellable device polling, and state-bound callback requirements.
- Preserve Pi peers at `>=0.80.1 <0.81.0`, exact 0.80.1/0.80.10 boundaries, and read-only startup credential compatibility.
- Encrypted reasoning remains deferred to issue #79.

## Delivery

- This worktree has one writer; delegated reviewers are read-only.
- Update scaffold state after major phases.
- Run focused tests, strict full tests, typecheck, coverage, live package checks, and both exact packed compatibility boundaries before push.
- Rebase without dropping merged issue #78 wire/security or issue #93 Pi compatibility behavior.
- Force-push only after independent final review reports no blockers.
