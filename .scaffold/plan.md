# Implementation Plan — Refresh PR #101: Contain Grok-Native Direct File Adapters

**Branch:** `cursor/critical-bug-management-92fc`
**Base:** `origin/main` at `fe8250575403fa7929ae4e6508a5f09ef45b3d91`
**Stale PR safety ref:** `safety/pr-101-stale` (`0f9ca07b71699a933b094a968539fe5739b23d6b`)

## Goal

Apply deterministic post-`realpath` workspace containment to Grok-native `read_file`,
`search_replace`, and `list_dir`, retain bounded full-file reads and pi's mutation
semantics, and document the deliberate exclusion of unrestricted terminal commands.

## Phases

1. [x] Confirm clean scope, current main, stale PR head, reviews, checks, and lease target.
2. [x] Preserve the stale head and rebuild the PR branch directly from current main.
3. [x] Reapply and audit the stale containment implementation.
4. [x] Harden missing-leaf and bounded-read behavior while preserving cancellation and queues.
5. [x] Add direct-adapter, oversized-read, safe-path, and unrestricted-terminal regressions.
6. [x] Clarify schemas, README, changelog, and persistent state.
7. [x] Run focused, full, coverage, typecheck, policy, boundary, and hygiene gates.
8. [ ] Obtain independent review, amend, exact-lease force-push, refresh PR #101, and merge.

## Validation Contract

- Relative and absolute in-workspace paths work for read, replace, create, and list.
- Outside absolute paths, escaping traversal, and outward file/directory symlinks fail.
- Missing leaves are creatable only through a physically contained existing parent.
- Package-owned full-file reads for negative offsets and exact replacement stop at
  5,000,000 bytes.
- Cancellation, pi's per-file mutation queue, stale-snapshot detection, and normal behavior remain.
- `run_terminal_command` still delegates to pi `bash` without workspace containment.
- `.claude/`, `anime-characters.jpg`, and `anime-characters.mp4` remain untracked.
