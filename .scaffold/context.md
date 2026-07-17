# Shared Agent Context — Issue #78

**Branch:** feature/issue-78-grok-protocol
**Issue:** https://github.com/BlockedPath/pi-xai-oauth/issues/78
**Original baseline:** 579f965
**Rebased baseline:** 0d51d0a
**Reviewed upstream:** `xai-org/grok-build@b189869b7755d2b482969acf6c92da3ecfeffd36`

## Evidence

- Scout `wP:p3` audited upstream/client behavior and current runtime/tests.
- Architect `wP:p2` produced the implementation handoff followed by the sole writer.
- `compatibility/grok-build-wire-protocol.md` records the pinned route/header matrix, ownership decisions, and repeatable review procedure.
- Issue #93 and PR #94 adopted exact Pi 0.80.10 while preserving the 0.80.1 minimum and bounded peer range.

## Decisions

- Centralize the route-aware contract and reserved-header scrub rather than patching callers independently.
- Use package name/version for truthful attribution; track the reviewed Grok Build revision separately.
- Keep Pi `sessionId` as conversation/session affinity when available; mint a shared fallback UUID and a fresh request UUID.
- Omit agent/turn/deployment/user headers because Pi does not expose equivalent authoritative values across all flows.
- Treat streaming SSE Accept as route-specific; keep direct Responses/media JSON-only.
- Bound and classify transport errors without reflecting raw upstream bodies.
- Record encrypted reasoning as the #79 follow-up; do not implement replay here.
- Preserve Pi 0.80.10's `readStoredCredential()`/JSON-only legacy startup path and exact 0.80.1/0.80.10 matrices during rebase.

## Validation focus

- Prove contract-header precedence through Pi's final OpenAI Responses transport assembly.
- Preserve catalog and OAuth bounded-body behavior.
- Re-run the complete policy, pack, loader, typecheck, coverage, and exact-boundary gates after rebase.
