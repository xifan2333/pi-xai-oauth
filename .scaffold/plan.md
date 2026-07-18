# Implementation Plan — Restore Grok 4.3 OAuth visibility

**Branch:** `feature/restore-grok-4-3-oauth`

## Goal

Restore `xai-auth/grok-4.3` when the authenticated catalog exposes `grok-4.5`, without mutating the exact `/models-v2` cache or treating Grok 4.3 as a canonical alias of Grok 4.5.

## Phases

1. [x] Compare pi's normalized cache with the official Grok CLI cache.
2. [x] Verify current public documentation and run one bounded authenticated route probe.
3. [x] Add a separate entitlement-compatibility mapping for the distinct `grok-4.3` request slug.
4. [x] Preserve authenticated modality evidence and conservative source limits while adding Grok 4.3 reasoning levels.
5. [x] Add focused regressions and update README/AGENTS policy wording.
6. [x] Run full unit, loader, typecheck, coverage, and compatibility gates.

## Validation contract

- The persisted normalized cache remains the exact successful `/models-v2` result.
- `grok-4.3` is advertised only while its verified `grok-4.5` entitlement source is present.
- `resolveXaiCanonicalModelId("grok-4.3")` remains `grok-4.3`.
- Compatibility expansion is not recursive; unverified Grok 4.3 aliases remain hidden.
- `.claude/` remains untracked and excluded from commits.
