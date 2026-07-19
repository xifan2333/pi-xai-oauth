# Shared Agent Context — PR #96

**PR:** https://github.com/BlockedPath/pi-xai-oauth/pull/96
**Branch:** `cursor/critical-bug-management-2bee`
**Base:** `origin/main` at `d6de44f`
**Stale head / exact lease:** `d1c0b11b5f81707831a13bbd2ca0f63f171129a7`
**Safety ref:** `safety/pr-96-stale`

## Current Architecture

- `extensions/xai/media/paths.ts` owns the existing async bounded workspace image reader.
- `extensions/xai/images.ts` owns synchronous legacy URL/path normalization.
- `extensions/xai/tools/custom-tools.ts` has the two context-aware tool callers.
- `extensions/xai/payload.ts` and `extensions/xai/vision-routing.ts` are newer synchronous
  callers that use the provider-session working directory.
- `extensions/xai/media/data-url.ts` owns canonical verified-byte serialization.

## Approved Approach

Add `readBoundedWorkspaceImageFileSync(inputPath, workspaceRoot)` beside the async reader,
sharing containment, limits, image inspection, and `VerifiedImageBytes`. Keep the same
realpath, regular-file, no-follow/nonblocking open, bounded-read, pixel, and sanitized-error
policy. Make `normalizeXaiImageInput(value, workspaceRoot = process.cwd())` retain remote/data
pass-through, decode compatible local path syntax, enforce extension/MIME agreement, and
serialize only verified bytes.

## Delivery State

The old PR implementation is deliberately not present on the working branch. It relied on a
separate `statSync` plus unbounded `readFileSync`, lacked descriptor-level defenses, reflected
paths in some errors, and did not cover current payload/vision callers. The refreshed branch
will replace it wholesale after all gates and independent review pass.
