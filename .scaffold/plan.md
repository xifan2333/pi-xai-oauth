# Plan: Fix Page Up/Down no-op at ten items (issue #59)

**Branch:** cursor/fix-page-keys-ten-items-7537

**Goal:** Page Up/Down in `/xai-tools` TUI must wrap when exactly ten eligible tools are shown (Grok Build/Composer + WebSearch).

## Steps
- [x] Reproduce: `moveSelection(±maxVisible)` with `options.length === 10` is a modulo no-op
- [x] Fix `moveSelection` to fall back to ±1 when `offset % length === 0`
- [x] Add Composer (10-tool) regression in `scripts/verify-extension.js`
- [x] Run `npm run typecheck` and `npm test`
- [x] Commit, push, open PR
