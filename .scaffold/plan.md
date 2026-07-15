# Documentation Plan: Add Release Changelog

**Branch:** feature/changelog

**Date:** 2026-07-15

**Goal:** Record notable features and fixes by release without bloating the current-usage README.

## Implementation
- [x] Verify published versions and publication dates from npm.
- [x] Derive notable changes from version bumps, commits, and merged fixes.
- [x] Add `CHANGELOG.md` with detailed 1.2.0-1.3.5 entries and a transparent initial-series summary.
- [x] Link the changelog prominently from README.

## Verification
- [x] Review every release claim against repository and npm `gitHead` history.
- [x] Run Markdown, diff, test, typecheck, and package-content checks.

**Owner:** Main agent

**Next action:** Commit and open a PR when requested.
