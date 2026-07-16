# Implementation Plan — Issue #83

**Branch:** feature/issue-83-image-editing
**Baseline:** `b0556a8`

## Goal

Finish PR #91 as a disabled-by-default, bounded `xai_edit_image` feature integrated with merged PR #90 transport, modality, and privacy guarantees.

## Phases

1. [x] Verify PR #90 merged exactly as reviewed and create a safety branch for `e31303f`.
2. [ ] Rebase the two PR #91 commits onto `b0556a8` and semantically synthesize conflicts.
3. [ ] Change the reference contract to one to three and tighten cheap aspect-ratio validation.
4. [ ] Integrate shared direct-JSON headers and route classification without weakening bounded edit response handling.
5. [ ] Enforce decoded output side/pixel limits and redact codec/compression failures.
6. [ ] Preserve disabled zero-I/O and text-only Responses-model independence with focused regressions.
7. [ ] Synthesize cumulative docs/scaffold content and remove stale counts, versions, and one-to-four claims.
8. [ ] Run focused, typecheck, strict full, coverage, package, loader, and exact Pi boundary validation.
9. [ ] Complete range-diff/invariant review and independent final reviews.
10. [ ] Push the rebased branch with lease, refresh PR #91, and verify all checks without merging.

## Validation contract

- Four references and invalid singular ratios fail before credentials, filesystem, codec, or network I/O.
- Both credential provenance tags use the exact pinned direct edit URL and protected direct-media headers.
- Exactly one bounded verified output is atomically persisted with private permissions.
- No prompt, source reference, credential, raw body, or codec/server detail is reflected.
- PR #90 catalog, payload, modality, routing, retry, and privacy behavior remains intact.
- Pi peers and exact 0.80.1/0.80.10 boundaries remain unchanged.
