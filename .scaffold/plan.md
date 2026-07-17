# Implementation Plan — PR #95 destructive Delete containment

**Branch:** `review/pr-95`
**Rebase baseline:** `139ad7b`
**Original PR head:** `a4e9746`

## Goal

Keep `Delete` unable to remove the workspace root or traverse physical filesystem aliases outside it, while preserving normal child deletion and final-symlink unlink behavior.

## Phases

1. [x] Confirm the dedicated PR worktree is clean and create `safety/pr-95-pre-main-rebase`.
2. [x] Rebase the original PR commit onto current `origin/main`.
3. [x] Encode intermediate-link, root-reentry, Windows case-alias, and final-symlink regressions.
4. [x] Resolve the real workspace and target parent before destructive deletion.
5. [x] Reject physical root/outside aliases and pass only the validated target to `fs.rm`.
6. [x] Run focused tests, the original reproducer, strict TypeScript, full tests, coverage, loader, package checks, and exact Pi boundaries.
7. [ ] Commit, push with exact lease, refresh PR #95, and verify checks/comments after clean independent review.

## Validation contract

- Direct `.`, `./`, absolute-root, and Windows case-variant root spellings are rejected.
- Intermediate symlinks or junctions cannot redirect `Delete` to the root or outside the workspace.
- A final symlink is unlinked without deleting its target.
- Ordinary files and directories physically inside the workspace remain deletable.
- Portable Node cannot eliminate a hostile concurrent parent-replacement race; the patch must minimize that window by using canonical validated parents and document the residual assumption.
