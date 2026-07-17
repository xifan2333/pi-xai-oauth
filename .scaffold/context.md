# Shared Agent Context — Issue #93

**Branch:** feature/issue-93-pi-0.80.10
**Issue:** https://github.com/BlockedPath/pi-xai-oauth/issues/93

## Baseline and release evidence

Pi 0.80.10 is the latest published release inside the existing `>=0.80.1 <0.81.0` peer range. Pi 0.80.8 introduced the unified `ModelRuntime` and current `CredentialStore` APIs, removed top-level `AuthStorage` as a public SDK surface, and added `readStoredCredential()` for one-off reads. Pi 0.80.9 and 0.80.10 primarily changed Kimi/xAI built-in catalogs and did not require provider transport changes here.

Official releases:

- https://github.com/earendil-works/pi/releases/tag/v0.80.8
- https://github.com/earendil-works/pi/releases/tag/v0.80.9
- https://github.com/earendil-works/pi/releases/tag/v0.80.10

## Decisions

- Keep peers and minimum unchanged.
- Set policy latest and both exact Pi dev dependencies to 0.80.10.
- Use the current synchronous `readStoredCredential()` API when available and a direct synchronous JSON-only fallback on older supported hosts so absent startup reads never create credential storage.
- Exercise canonical `ModelRuntime` plus `InMemoryCredentialStore` in current integration tests, with a runtime-detected legacy test path for the 0.80.1 packed boundary.

## Validation

The first clean packed 0.80.10 candidate run failed five tests because startup no longer saw expired Pi credentials through the removed export and the old integration test called the removed OAuth registry. After migration, full strict tests, coverage, loader smoke, typecheck, live registry/pack/unsupported checks, the clean 0.80.10 candidate, and exact packed 0.80.1/0.80.10 boundaries pass.
