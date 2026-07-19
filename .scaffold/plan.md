# Implementation Plan — Refresh PR #96: Bound Legacy Local Image Inputs

**Branch:** `cursor/critical-bug-management-2bee`
**Base:** current `origin/main`
**Stale PR safety ref:** `safety/pr-96-stale` (`d1c0b11b5f81707831a13bbd2ca0f63f171129a7`)

## Goal

Keep legacy PNG/JPEG path support, but materialize local images only from byte-bounded,
validated regular files physically contained in the active workspace. Cover the custom
tools and every current synchronous payload/vision normalization caller.

## Phases

1. [x] Confirm clean scope, current main, stale PR head, and exact-lease delivery target.
2. [x] Audit the current shared media reader and all `normalizeXaiImageInput` callers.
3. [x] Add a synchronous counterpart to the hardened bounded workspace reader.
4. [x] Route legacy path normalization through verified bytes and canonical data URLs.
5. [x] Make both custom tools pass `ctx.cwd` and fail closed for local input without it.
6. [x] Add direct, tool, payload, and vision-routing regressions plus documentation.
7. [x] Run focused, full, coverage, typecheck, policy, and exact-boundary gates.
8. [ ] Obtain independent review, commit, exact-lease force-push, refresh PR #96, and mark ready.

## Validation Contract

- HTTP(S) and existing `data:image/...` strings remain pass-through inputs.
- Local `.png`, `.jpg`, and `.jpeg` inputs must resolve inside the selected workspace.
- Local files must be regular, non-empty, at most 8 MiB, byte-valid PNG/JPEG, and at
  most 12 million decoded pixels.
- Local extensions must be supported and must agree with inspected image bytes.
- Leaf/intermediate outward symlinks, traversal, special files, malformed paths, MIME
  spoofing, oversized files, and pixel bombs fail locally without reflecting paths.
- Tool-local paths require a valid `ctx.cwd`; provider payload and vision callers keep
  `process.cwd()` as their synchronous session default.
- `.claude/`, `anime-characters.jpg`, and `anime-characters.mp4` remain untracked.
