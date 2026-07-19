# Implementation Plan — Issue #114: Post-hook vision pruning

**Branch:** `fix/114-post-hook-vision-pruning`
**Base:** `origin/main` at `941cb4a`

## Goal

Prevent caller payload hooks from reintroducing consumed historical images into the
vision-routing target request while preserving current images, text-only enforcement,
screenshot schema, and the original captured grant.

## Phases

1. [x] Confirm issue scope, clean branch, and current payload/vision flow.
2. [x] Extract a shared consumed-history payload helper.
3. [x] Reapply pruning to the canonical post-hook payload before route planning.
4. [x] Add streaming regressions for hook-returned user images and screenshots.
5. [x] Document post-hook pruning and update the changelog.
6. [x] Run full tests, typecheck, compatibility checks, and independent review.

## Validation Contract

- Historical hook-returned user images never reach the vision target.
- Current hook-returned images still route when the captured grant is valid.
- Historical `computer_call_output.output` remains object-shaped and reference-free.
- Disabled routing still rejects hook-added images rather than silently pruning them.
- Reset/re-enable cannot authorize a request under a replacement grant.
