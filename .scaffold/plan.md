# Implementation Plan: Preserve /xai-tools Picker Focus

**Branch:** feature/xai-tools-picker-focus

**Date:** 2026-07-15

**Goal:** Keep the highlighted `/xai-tools` row and scroll position stable after toggling a tool.

## Implementation
- [x] Reproduce the cursor reset caused by reopening `ctx.ui.select()` after every toggle.
- [x] Confirm pi's selector API has no supported initial-index option.
- [x] Replace the TUI loop with one stateful custom component that toggles tools in place.
- [x] Keep the existing selector fallback for RPC mode.
- [x] Preserve model eligibility, per-tool authorization, credit warnings, and fail-closed updates.

## Verification
- [x] Add regression coverage proving the selected image-generation row remains highlighted after toggling.
- [x] Preserve RPC picker coverage.
- [x] Run the extension test suite.
- [x] Run final typecheck, diff checks, package inspection, and focused review.

**Owner:** Main agent

**Next action:** Commit and open a PR when requested.
