# Execution Progress — Issue #117

**Branch:** `test/117-historical-image-text`
**Started:** 2026-07-20

## Completed

- [x] Read issue #117 and confirmed the mixed historical-user-image test gap.
- [x] Audited `omitConsumedXaiResponsesVisionImages` and `withHistoricalUserImagePlaceholder` to confirm ordinary user text survives while the historical image is replaced by the bounded placeholder.
- [x] Exported `HISTORICAL_USER_IMAGE_PLACEHOLDER` from `extensions/xai/payload.ts` so the mixed-content invariant can be asserted exactly.
- [x] Split the shared parameterized user-image test: kept the image-only case with its existing assertions and added a dedicated mixed-content test asserting the distinct invariant (text survives, image replaced by placeholder).
- [x] Focused payload tests passed (21 tests).
- [x] Typecheck passed.
- [x] Full `npm test` passed (43 files / 486 tests plus loader).
- [x] Pi Lens reported no primary LSP errors in the changed TypeScript files (only pre-existing project-wide style warnings).

## Delivery

Issue #117 is implemented and validated, ready to commit or open as a PR.
