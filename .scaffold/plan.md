# Implementation Plan: Issue #93 Pi 0.80.10 compatibility

**Branch:** feature/issue-93-pi-0.80.10
**Baseline:** 579f965

## Goal

Adopt Pi 0.80.10 as the latest exact compatibility boundary while preserving the 0.80.1 minimum and `>=0.80.1 <0.81.0` peer range.

## Phases

1. [x] Confirm registry drift to 0.80.10 and review official 0.80.8–0.80.10 releases.
2. [x] Run the clean packed 0.80.10 candidate matrix and record the API migration failures.
3. [x] Replace startup `AuthStorage` use with a bounded current/legacy read compatibility path.
4. [x] Migrate the Pi credential integration test to `ModelRuntime`/`InMemoryCredentialStore` while retaining the 0.80.1 path.
5. [x] Align policy latest, exact dev dependencies, and lockfile to 0.80.10.
6. [x] Update README, CHANGELOG, AGENTS, and scaffold state.
7. [x] Run full latest and exact 0.80.1/0.80.10 validation.
8. [x] Complete independent review and apply accepted fixes.
9. [x] Commit, push, and open PR #94 for issue #93.

## Validation contract

- Focused credential/race regressions pass.
- `npm test`, strict full test, coverage, loader smoke, and typecheck pass on the repository install.
- `npm run compatibility:check` passes against the live registry.
- Clean packed exact 0.80.1 and 0.80.10 matrices pass tests, loader smoke, and typecheck.
- Pack metadata and unsupported-peer diagnostics remain correct.
- Peer range and minimum remain unchanged.
