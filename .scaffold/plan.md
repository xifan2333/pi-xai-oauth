# Implementation Plan: Issue #80 authenticated model input modalities

**Branch:** feature/issue-80-model-modalities
**Original baseline:** 579f965
**Rebased baseline:** c0c89b0
**Issue:** https://github.com/BlockedPath/pi-xai-oauth/issues/80

## Goal

Derive advertised model input modalities from bounded authenticated evidence when present, preserve conservative known/default behavior when evidence is absent or malformed, migrate the normalized cache without changing entitlement membership, and stop image-bearing OAuth Responses locally for an authenticated text-only entitlement.

## Phases

1. [x] Read issue #80, pinned upstream evidence, provider/catalog/cache/payload/Responses/tool paths, tests, docs, and package policy.
2. [x] Add strict `acceptsImages` / `inputModalities` resolution with explicit provenance and documented precedence.
3. [x] Migrate schema-1 normalized caches in memory while preserving exact membership and emitting schema 2 only on the next normal atomic write.
4. [x] Keep provenance in runtime entitlement snapshots but strip it from Pi provider definitions.
5. [x] Add final current-snapshot image-input enforcement after payload hooks and before direct/stream OAuth network I/O.
6. [x] Add redacted/synthetic fixtures and focused catalog, cache, provider, Responses, and custom-tool coverage.
7. [x] Document observed schema absence, source revision, precedence, fallback, cache migration/privacy, and local rejection behavior.
8. [ ] Complete the rebase onto current main while retaining issue #78 wire/security and issue #93 Pi 0.80.10 behavior.
9. [ ] Run focused suites, strict full tests, typecheck, coverage, package checks, and exact packed Pi 0.80.1/0.80.10 boundaries.
10. [ ] Obtain independent final review, apply accepted fixes, force-push, refresh PR #90, and wait for fresh required checks.

## Validation contract

- Successful authenticated catalogs retain exact additions, removals, ordering, and empty membership.
- Only exact bounded camelCase capability fields are accepted; malformed evidence falls through without excluding a model.
- Authenticated evidence overrides known metadata; missing evidence does not make Composer text-only.
- Schema-1 caches never acquire authenticated provenance and retain exact normalized entitlement membership.
- No raw response, credential, identity, endpoint, header, image URL, or image data enters cache or rejection errors.
- Authenticated text-only image input is rejected after all payload hooks and compaction, before any fetch, including custom text/image-analysis tools.
- Redirect rejection, reserved-header protection, stable prompt cache keys, and generic affinity suppression remain intact.
- Image generation is unchanged; encrypted reasoning remains deferred to #79.
- Pi peers remain `>=0.80.1 <0.81.0` with exact packed 0.80.1/0.80.10 proof.
