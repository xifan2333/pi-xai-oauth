# Shared Agent Context — PR #101

**PR:** https://github.com/BlockedPath/pi-xai-oauth/pull/101
**Branch:** `cursor/critical-bug-management-92fc`
**Base:** `origin/main` at `fe8250575403fa7929ae4e6508a5f09ef45b3d91`
**Stale head / exact lease:** `0f9ca07b71699a933b094a968539fe5739b23d6b`
**Safety ref:** `safety/pr-101-stale`

## Current Architecture

- `extensions/xai/tools/grok-native.ts` registers the direct file, grep, terminal, and web adapters.
- `safeWorkspacePath` rejects lexical escapes before filesystem resolution.
- `physicalWorkspaceSearchPath` already gives `grep` post-`realpath` containment.
- The refreshed shared path resolver applies equivalent containment to read/replace/list,
  including a safe missing-leaf path through a contained physical parent.
- Package-owned negative-offset and exact-replacement reads use a 5,000,000-byte bounded loop.
- Pi's built-in read/list/write definitions still provide normal behavior and write serialization.

## Security Scope

This is defense-in-depth for direct file adapters. It is not a complete sandbox.
`run_terminal_command` remains intentionally unrestricted and delegates to pi `bash`.
The pathname-based pi adapters also do not claim resistance to concurrent same-user
filesystem namespace swaps; descriptor-relative traversal is outside this PR's scope.

## Delivery State

The stale two-file patch was preserved, rebuilt on current main, and expanded with missing
regressions, honest schemas, documentation, stricter missing-leaf handling, and bounded
descriptor reads. All requested local gates and both clean packed Pi matrices pass, and
independent review is clean within the stated scope. Exact-lease publication, fresh GitHub
checks, and merge remain.
