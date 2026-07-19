# Execution Progress — vision-routing Pi converter hardening

**Branch:** `fix/pr-109-review`
**Started:** 2026-07-19

## Completed

- [x] Audited vision routing + encrypted reasoning replay paths.
- [x] Confirmed encrypted reasoning isolation (Pi provider/API/model match; vision
      description request sends no history/ciphertext).
- [x] Found critical bug: Pi `downgradeUnsupportedImages` strips images for
      text-only models before `onPayload`, so vision routing never saw real
      conversation images (tests only injected via `onPayload`).
- [x] Fixed `streamSimpleXaiResponses` to temporarily advertise `image` on the
      delegated conversion model while vision routing is enabled.
- [x] Added regression covering Pi-converted user image messages.
- [x] Documented the temporary conversion advertisement in
      `docs/model-input-modalities.md` and `CHANGELOG.md`.
- [x] Focused vision-routing suite + full `npm test` + typecheck +
      `compatibility:check` passed.
- [x] Scoped synthetic image capability to Pi's delegated converter while keeping
      package rewrites and payload hooks on truthful text-only metadata.
- [x] Bound each routed stream to its captured grant signal so reset/re-enable
      cannot authorize an old request under a replacement account or catalog.
- [x] Omitted consumed historical user images with a bounded placeholder while
      preserving current user/tool images and ordinary image-capable behavior.
- [x] Added multi-turn, real Pi tool-result, grant ABA, late-enable, hook metadata,
      image-only, and text-plus-image regressions.
- [x] Closed independent review's remaining historical `computer_call_output`
      screenshot replay gap with bounded pruning and focused coverage.
- [x] Preserved the required `computer_screenshot` output object while removing
      its image references and adding a separate bounded historical placeholder.

## In Progress

- [x] Full `npm test` passed (43 files / 481 tests + loader), typecheck and
      compatibility policy passed, exact Pi 0.80.1 / 0.80.10 boundaries passed,
      and final independent review reported no concrete blocker.

## Delivery

- [x] Published fix PR: https://github.com/BlockedPath/pi-xai-oauth/pull/109
