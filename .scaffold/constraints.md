# Constraints & Safety Rules — Issue #69

## Hard Boundaries (MUST NOT)
- Never advertise Pi releases that have not passed the packed-package compatibility suite.
- Never let a matrix cell reuse the repository lockfile's Pi versions or pass without asserting the exact requested/resolved pair.
- Never use `--legacy-peer-deps` or `--force` to make a supported compatibility cell pass.
- Never widen into an untested pre-1.0 minor line; keep a conservative exclusive upper bound.
- Never migrate the test framework, implement issue #68, modernize publishing, or upgrade unrelated dependencies.
- Never alter OAuth, routing, proxy-header, catalog, OIDC/state, device-login, or paid-tool runtime behavior from issues #63-#67.

## Required Practices (MUST)
- Work only on `feature/issue-69-pi-peer-range` from current merged `origin/main` through PR #75.
- Keep both Pi peer ranges byte-identical unless a documented package constraint proves otherwise.
- Keep normal development dependencies exact at the checked-in latest allowed release; use isolated exact installs for the minimum matrix boundary.
- Verify source metadata, lock metadata, CI policy, registry maximum, and packed manifest cannot drift silently.
- Prove older and next-minor versions fail the range and produce npm peer-resolution diagnostics before runtime loading.
- Document a deliberate review/test process before changing the minimum, latest tested release, or upper bound.
- Update scaffold progress after major steps and complete independent dependency/CI/correctness/docs review before delivery.

## npm Test Safety
`--force` is allowed only in a temporary negative consumer fixture to prove npm emits an unsupported-peer warning. Positive installs must use strict peer resolution in a clean packed-package sandbox.
