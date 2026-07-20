# Execution Progress — Vision-routing hardening series

**Branch:** `chore/118-scaffold-progress`
**Base:** `origin/main` at `24df74a`
**Series window:** 2026-07-19 → 2026-07-20

## Completed

### Core fix (PR #109)

- [x] Advertise `image` only on Pi's delegated Responses conversion-model copy so vision routing sees real conversation images; catalog metadata, package rewrites, and payload hooks keep truthful text-only source capability.
- [x] Bind each routed stream to the grant captured at stream start so reset/re-enable cannot authorize an old request.
- [x] Replace consumed historical user images and computer screenshots with bounded placeholders while preserving current unconsumed user/tool images and the `computer_screenshot` object shape.
- [x] Keep encrypted reasoning isolated: the vision target request sends no conversation history, tools, or ciphertext.
- [x] Document the conversion advertisement and lifecycle rules in `docs/model-input-modalities.md` and `CHANGELOG.md`.
- [x] Merged: <https://github.com/BlockedPath/pi-xai-oauth/pull/109>

### Post-hook recursive pruning (PR #120 / #114)

- [x] Share `omitConsumedXaiResponsesVisionImages` before and after caller payload hooks.
- [x] Recursively strip every image shape recognized by route planning from consumed history.
- [x] Merged: <https://github.com/BlockedPath/pi-xai-oauth/pull/120>

### Follow-up cleanup

- [x] #115 / PR #122: trim duplicated Pi-converted vision regression assertions.
- [x] #116 / PR #123: use typed `model.input` in vision conversion routing.
- [x] #117 / PR #126: assert mixed historical content retains ordinary user text with the bounded placeholder.
- [x] #119: split vision-routing modality docs into conversion, authorization-lifecycle, and request-behavior paragraphs (on main as `24df74a`).

## Final validation (series)

- [x] Full `npm test` passed on the series tip (43 files / 486 tests + loader).
- [x] Typecheck, compatibility policy/pack checks, and exact Pi 0.80.1 / 0.80.10 boundaries passed.
- [x] Independent/fresh-context reviews of the security fixes reported no remaining blockers.

## In Progress

- None.

## Delivery

- [x] Vision-routing hardening and follow-ups are merged on `origin/main` (`24df74a`).
- [x] Scaffold progress consolidated under issue #118; branch and delivery state match post-merge main.
