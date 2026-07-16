# Implementation Plan: Issue #68 focused Vitest suites

**Branch:** feature/issue-68-vitest-suites
**Baseline:** 97ac7c9 (current origin/main at branch creation)

## Goal
Replace the monolithic behavior verifiers with focused typed Vitest suites while preserving every regression assertion, retaining a small real Pi loader smoke, and keeping packed Pi 0.80.1/0.80.7 compatibility proof.

## Phases

1. [x] Read issue #68, current runtime, package/lock/CI/compatibility scripts, every verifier/assertion/fixture, Pi test patterns, and current Vitest 4/Node 24 guidance.
2. [x] Record the pre-edit assertion inventory and destination map in `docs/testing/assertion-parity.md`.
3. [x] Add exact Vitest/V8 dependencies, strict config, typed shared fixtures, scripts, test typechecking, and package-boundary assertions.
4. [x] Migrate catalog/cache, device/browser OAuth/OIDC/refresh, provider/model routing, payload/stream/errors, images, tools/lifecycle, Cursor shims, and setup.
5. [x] Run old and new tests together, complete the parity checklist, then remove equivalent legacy behavior code.
6. [x] Keep and validate one small real Pi extension-loader smoke; update CI without duplicate unit execution.
7. [x] Establish V8 thresholds from the measured migrated baseline, then document focused/full/watch/smoke/coverage commands.
8. [x] Update README, CONTRIBUTING, CHANGELOG, AGENTS, scaffold, CI, and package contents.
9. [x] Run independent parity, isolation/flakiness, CI/compatibility, and simplicity reviews; apply accepted fixes.
10. [ ] Complete focused re-review, final validation, commit, push, and open an unmerged PR against main. The live registry gate currently reports newly published Pi 0.80.8; changing the required 0.80.1/0.80.7 policy is out of scope.

## Validation contract

- Focused suites and full `test:unit` pass with readable names.
- Real loader smoke and strict unhandled-rejection run pass.
- V8 coverage meets reviewed baseline thresholds.
- TypeScript 7 checks production, tests, fixtures, and config.
- Compatibility policy, registry, pack, unsupported peers, and exact 0.80.1/0.80.7 packed matrices pass.
- Workflow YAML, package dry run, diff check, and parity checklist pass.
- Production runtime behavior is unchanged except independently reviewed typed testability seams if unavoidable.
