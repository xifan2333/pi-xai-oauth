# Implementation Plan — Issue #116: Typed model input

**Branch:** `cleanup/116-typed-model-input`
**Base:** `origin/main` at `67524bb`

## Goal

Use the required `Model.input` type directly in vision conversion routing without
changing the converter-only synthetic image capability used by enabled routing.

## Phases

1. [x] Confirm issue scope, branch state, and the supported Pi `Model.input` contract.
2. [x] Review enabled and disabled vision-routing regressions.
3. [x] Replace the cast/fallback with a direct defensive copy of `model.input`.
4. [x] Run focused vision/image tests, typecheck, and the full test gate.
5. [x] Perform an independent final diff review.

## Validation Contract

- The conversion path reads `model.input` without a broad cast or fallback.
- Enabled routing still exposes a synthetic image capability only to Pi's converter.
- Disabled routing still rejects image payloads before transport.
- No duplicate model-input type is introduced.
