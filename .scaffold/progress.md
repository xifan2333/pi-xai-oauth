# Execution Progress — vision-routing Pi converter bypass

**Branch:** `cursor/critical-bug-management-846f`
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

## In Progress

- [ ] Compatibility boundaries + commit/push/PR.

## Delivery

- [ ] Publish fix PR for vision-routing Pi converter bypass.
