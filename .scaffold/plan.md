# Implementation Plan: Issue #78 Grok wire protocol

**Branch:** feature/issue-78-grok-protocol
**Original baseline:** 579f965
**Rebased baseline:** 0d51d0a

## Goal

Pin and document the reviewed Grok Build wire contract without impersonating the official client, while preserving OAuth/privacy boundaries, Pi 0.80.10 compatibility, and the encrypted-reasoning handoff to #79.

## Phases

1. [x] Read issue #78, upstream source, runtime callers, tests, package policy, and existing docs.
2. [x] Centralize truthful identity, route-aware headers, reserved-header scrubbing, OAuth form headers, and safe bounded transport errors.
3. [x] Apply the contract to streaming/direct Responses, catalog, OAuth/device/token, and direct media requests without changing pinned routes.
4. [x] Add deterministic request-shape, client-mode, SSE/direct, privacy, and safe gate-error coverage.
5. [x] Add the revision-pinned compatibility matrix/review procedure and update package documentation.
6. [ ] Complete rebase onto merged PR #94 without dropping protocol or Pi 0.80.10 behavior.
7. [ ] Run focused suites, strict full tests, coverage, typecheck, live compatibility checks, and exact 0.80.1/0.80.10 boundaries.
8. [ ] Complete independent review, apply accepted fixes, force-push, refresh PR #92, and mark it ready.

## Validation contract

- Streaming OAuth Responses explicitly requests `text/event-stream`; direct Responses does not.
- Caller/model reserved headers cannot override the internal route contract or inject unsupported IDs.
- OAuth proxy, catalog, direct API-key Responses, media, and OAuth/token routes use distinct tested header sets.
- HTTP status remains available while raw or oversized upstream error bodies remain undisclosed.
- Package identity stays `pi-xai-oauth`; the reviewed Grok Build revision is documentation metadata, not an impersonated client version.
- Pi peers remain `>=0.80.1 <0.81.0` with exact packed 0.80.1/0.80.10 proof.
- Encrypted reasoning remains deferred to #79.
