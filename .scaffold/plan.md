# Release Plan: pi-xai-oauth 1.3.4

**Branch:** feature/release-1.3.4

**Date:** 2026-07-15

**Goal:** Prepare the merged issue #54 safety fix for npm as patch release 1.3.4.

## Release preparation
- [x] Sync local `main` with merged PR #55.
- [x] Create a dedicated release branch.
- [x] Bump `package.json` and `package-lock.json` from 1.3.3 to 1.3.4.
- [x] Update README release and upgrade guidance.
- [x] Exclude local `pi-session-*.html` exports from npm packages.
- [x] Run tests, TypeScript validation, diff checks, and package inspection.
- [x] Authenticate npm as `blockedredemption`.
- [ ] Commit and publish the release branch when requested.
- [ ] After the release PR is merged, publish `pi-xai-oauth@1.3.4` from synced `main`.

**Owner:** Main agent

**Next action:** Commit and open the release PR.
