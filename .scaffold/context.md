# Shared Agent Context — Issue #83

**Branch:** feature/issue-83-image-editing
**Issue:** https://github.com/BlockedPath/pi-xai-oauth/issues/83
**Original commits:** `4a61389`, `e31303f`
**Post-PR-90 baseline:** `b0556a8`
**Safety branch:** `safety/issue-83-pre-pr90-rebase`

## Evidence and decisions

- Pinned source: `xai-org/grok-build@b189869b7755d2b482969acf6c92da3ecfeffd36`.
- Current first-party documentation limits edits to three source images, so the final package contract is one to three.
- Use Pi's public worker-backed `resizeImage`; add no image dependency.
- Keep the source-backed 400 KiB pass-through, 768 px compression maximum, 256 px floor, and quality steps inside stricter package-owned byte/pixel budgets.
- Route both credential provenance tags to the pinned public edit endpoint without adding API-key environment fallback.
- Persist one verified output under hashed Pi session storage and return only safe metadata.

## Integration focus

- PR #90 is merged exactly as reviewed. Preserve its catalog modality, payload canonicalization, retry, canonical-model, and privacy behavior.
- Adopt shared direct-JSON header construction and route classification from `wire.ts`; edits remain direct public media requests, never proxy requests.
- Keep disabled zero-I/O behavior and permit explicitly enabled edits under an authenticated text-only active Responses model.
- Reapply decoded output side and pixel limits after codec verification and redact all codec/compression failures.

## Validation state

- Rebase started from clean `e31303f` after verifying `origin/main=b0556a8` contains the exact reviewed PR #90 tree.
- No live xAI request is part of deterministic validation.
