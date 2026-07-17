# Shared Agent Context — Issue #80

**Branch:** feature/issue-80-model-modalities
**Issue:** https://github.com/BlockedPath/pi-xai-oauth/issues/80
**Original baseline:** 579f965
**Rebased baseline:** c0c89b0
**Reviewed upstream:** `xai-org/grok-build@b189869b7755d2b482969acf6c92da3ecfeffd36`

## Evidence

- A bounded redacted authenticated `/models-v2` observation on 2026-07-16 found no `acceptsImages` or `inputModalities` fields in either entry or `_meta`. Raw responses, credentials, headers, identity fields, endpoints, and account membership were not retained.
- The pinned Grok Build source recognizes `acceptsImages` before `inputModalities`, defaults missing evidence image-capable in its own client, and does not establish Composer as text-only.
- Current main includes issue #78's centralized route/header contract, redirect rejection, safe errors, and generic affinity suppression, plus issue #93's Pi 0.80.10 compatibility migration.

## Decisions

- Keep distinct normalized provenance for authenticated `acceptsImages`, authenticated `inputModalities`, known metadata, and conservative unknown default.
- Accept only exact `text` / `image` values in nonempty arrays of at most two unique entries, with canonical ordering.
- Authenticated `acceptsImages` wins over authenticated `inputModalities`; entry wins over `_meta` for the same key; malformed values fall through.
- Missing/malformed evidence uses known metadata when available, so Composer remains image-capable unless stronger evidence says otherwise. Unknown models remain conservative text without authenticated-denial provenance.
- Read schema 1 safely in memory by rederiving input from known/default policy; the next normal atomic write emits schema 2.
- Keep provenance internal to runtime/cache and omit it from Pi provider definitions.
- Reject image input only for authenticated text-only provenance, using the current runtime snapshot after all rewrites/hooks/compaction and immediately before OAuth transport. Image generation is unchanged.
- Keep Pi's generic delegate `sessionId` undefined to suppress its affinity headers while passing the stable session only to payload rewriting for `prompt_cache_key`.

## Validation focus

Guard against malformed/missing metadata becoming denial, schema-1 input gaining authenticated provenance, raw-field leakage, stale snapshot capture, pre-hook enforcement, image-generation conflation, weakened entitlement/cache races, wire-header regressions, redirect-guard leakage, or Pi-boundary drift.
