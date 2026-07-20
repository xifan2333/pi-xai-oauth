# Constraints & Safety Rules — Issue #118

## Scaffold-only scope

- Touch only `.scaffold/*` for this issue.
- Do not change production code, tests, modality docs, changelog, package version, or OAuth behavior.
- Do not invent unmerged work or restate closed issues as open.

## Progress content rules

- Keep security-relevant vision-routing decisions: converter-only image advertisement, truthful text-only metadata elsewhere, grant capture/invalidation, consumed historical-image pruning (including post-hook recursive scrubbing), current-unconsumed image routing, and no history/tools/ciphertext on the vision target.
- Keep final validation evidence (test counts, typecheck, exact Pi boundaries, independent review outcome).
- Remove transient execution narration and duplicate converter/metadata/historical-image/validation bullets.
- Never leave completed work under `In Progress`.
- Keep branch and delivery state aligned with post-merge `origin/main`.

## Non-goals

- Do not re-open or re-implement vision-routing, pruning, or modality-doc work.
- Do not treat `.scaffold/` as an authoritative security control.
- Do not rewrite git history of earlier PRs.
