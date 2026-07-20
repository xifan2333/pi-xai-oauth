# Implementation Plan — Issue #119: Vision-routing modality documentation

**Branch:** `docs/119-vision-routing-modalities`
**Base:** `origin/main`

## Goal

Make the explicit vision-routing exception easier to audit by separating conversion, authorization-lifecycle, and request-behavior guarantees without changing policy or behavior claims.

## Phases

1. [x] Confirm issue scope, branch state, and the documented/runtime guarantees.
2. [x] Split the dense exception text and remove duplicated guarantees.
3. [x] Review the final diff against every acceptance criterion.

## Validation Contract

- Converter-only image advertisement is stated once and precisely.
- Grant capture, invalidation, and current-unconsumed-image handling remain explicit.
- The target request remains image-only and the final source assertion remains text-only.
- Privacy, entitlement, and request behavior claims do not change.
