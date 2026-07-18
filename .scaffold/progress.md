# Execution Progress — Grok-native tool adapters

**Branch:** `feature/grok-native-tools`

## Completed

- [x] Added entitlement-aware known aliases without expanding the exact persisted catalog.
- [x] Limited Grok CLI payload compatibility quirks to exact `grok-build`; tool activation is model-independent within `xai-auth`.
- [x] Replaced Cursor-era adapter modules and tests with Grok-native equivalents.
- [x] Implemented official model-facing names and argument normalization for local read, exact replace, list, grep, terminal, and opt-in xAI web search.
- [x] Added integer validation, signed read offsets, PDF field validation with explicit unsupported execution, CRLF/BOM-preserving exact replacement, and exact `allowed_domains` preservation.
- [x] Added physical workspace containment and bounded local grep behavior, including multiline and hidden output modes.
- [x] Rejected unsupported managed background terminal calls; retained Grok millisecond timeout semantics while converting to pi seconds.
- [x] Registered all adapters under private `xai_grok_*` names to avoid extension registry collisions.
- [x] Added request-scoped public exposure and streamed-call internalization for all Grok-native tools.
- [x] Removed external public-tool shadow/restoration state; unrelated extension activation now remains untouched.
- [x] Updated focused tests, loader smoke expectations, README, and AGENTS architecture wording.
- [x] Passed strict TypeScript, 412 unit tests, loader smoke, V8 coverage floors, `git diff --check`, and exact packed Pi 0.80.1/0.80.10 compatibility boundaries.
- [x] Added worker-isolated grep matching, mixed-line-ending/BOM replacement regressions, official negative-offset edge coverage, and concurrent streamed route-isolation coverage.
- [x] Completed fresh independent review with no blocker/high correctness or security findings.
- [x] Verified live offline `/reload` with `xai-auth/grok-4.5` while `pi-web-access` and the local xAI extension were both loaded; pi reported a successful reload without registration collisions.

## Delivered

- [x] Committed the reviewed implementation without `.claude/`, opened PR #99, and closed superseded PR #98.

## Residual / intentional adaptations

- Pi does not expose Grok's managed background task lifecycle, so `background: true` fails closed.
- Pi's text reader cannot render PDF pages, so PDF `read_file` calls fail with guidance instead of pretending support.
- Local grep uses a conservative workspace-only implementation and bounded file-type subset rather than spawning the full Grok ripgrep environment.
- `.claude/` is unrelated untracked state and must not be committed.
