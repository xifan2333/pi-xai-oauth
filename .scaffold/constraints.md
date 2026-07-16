# Constraints & Safety Rules — Issue #83

## Image-edit boundary

- `xai_edit_image` remains disabled by default and session-scoped through `/xai-tools`.
- Disabled calls fail before parameter/context reads, credential lookup, filesystem/codecs, fetch, or output writes.
- Accept one to three byte-validated PNG/JPEG references from workspace-contained regular files or strict canonical data URLs.
- Reject four references before credential, filesystem, codec, or network access.
- Reject remote/file URLs, attachment or Files API identifiers, WebP, caller endpoints, and caller output paths.
- Require a supported aspect ratio for multiple references; validate any supplied singular ratio but omit it from the wire.
- Pin `/v1/images/edits`, fixed model/count/resolution/response format, redirect rejection, cancellation, timeout, and bounded bodies.
- Verify exactly one canonical base64 PNG/JPEG output, including decoded byte/pixel/side limits, before atomic 0700/0600 session storage.
- Never reflect prompts, source paths/data URLs/images, credentials, headers, raw bodies, or lower-layer codec messages.

## Inherited main invariants

- Preserve exact authenticated catalog membership, schema-2 modality provenance, cache migration, refresh locking, and privacy behavior.
- Preserve inert final Responses payload canonicalization, canonical runtime model binding, computer-screenshot detection, zero SDK retries, and pre/post-compaction modality enforcement.
- Preserve centralized route-aware wire headers, reserved-header scrubbing, redirect rejection, safe errors, and generic-affinity suppression.
- Image editing is independent of the active Responses model's authenticated text/image modality.
- Preserve OAuth PKCE/state/nonce/OIDC and bounded device authorization behavior.
- Keep Pi peers at `>=0.80.1 <0.81.0` with exact packed 0.80.1/0.80.10 boundaries.

## Delivery

- The issue-83 worktree has one writer; delegated agents are read-only.
- Base the rebased branch on merged PR #90 at `b0556a8`; preserve safety branch `safety/issue-83-pre-pr90-rebase`.
- Update scaffold state after major phases.
- Run focused, strict full, typecheck, coverage, package, loader, and exact boundary validation before publishing.
- Do not merge PR #91 or make live paid xAI calls.
