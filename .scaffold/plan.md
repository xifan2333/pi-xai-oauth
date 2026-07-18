# Implementation Plan — Grok-native tool adapters

**Branch:** `feature/grok-native-tools`

## Goal

Replace Cursor-style compatibility shims with collision-free pi dispatchers that expose Grok's official model-facing tool names and argument contracts for every `xai-auth` model, while keeping network search opt-in and entitlement behavior exact.

## Phases

1. [x] Compare the existing shims with the official local Grok implementations under `/Users/justin/Projects/grok`.
2. [x] Rename the adapter modules and implement official contracts for `read_file`, `search_replace`, `list_dir`, `grep`, `run_terminal_command`, and opt-in `web_search`.
3. [x] Add strict local safety behavior: workspace containment, symlink checks, grep input/output/time bounds, exact replacement, and explicit unsupported background/PDF paths.
4. [x] Register collision-free `xai_grok_*` dispatch names and translate only current xAI request definitions to public Grok names.
5. [x] Make streamed tool-call internalization request-scoped and preserve unrelated extensions' public tool state across lifecycle transitions.
6. [x] Update focused tests, loader expectations, README, and architecture notes.
7. [x] Complete independent review and run the full test/typecheck/coverage/compatibility gates.
8. [x] Perform live `/reload` coexistence verification with `pi-web-access`.
9. [x] Commit the final branch without `.claude/`, open PR #99, and close superseded PR #98.

## Validation contract

- Successful `/models-v2` results remain exact entitlement state; aliases derive only from entitled canonicals.
- No public Grok tool name is registered globally by this package.
- Outbound xAI payloads contain official public names without duplicates; returned calls route privately only for tools exposed by that request.
- Other extensions' public tool activation is never shadowed, snapshotted, or restored by this package.
- Local grep remains physically inside the workspace and bounded by file, scan, time, line, and output limits.
- `background: true` and unsupported PDF reads fail explicitly instead of silently changing semantics.
- `.claude/` remains untracked and excluded from commits.
