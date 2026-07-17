# Shared Agent Context — Issue #82

**Branch:** feature/issue-82-xai-usage
**Issue:** https://github.com/BlockedPath/pi-xai-oauth/issues/82
**Upstream pin:** xai-org/grok-build@b189869b7755d2b482969acf6c92da3ecfeffd36
**Rebase baseline:** `af31e83`
**Safety branch:** `safety/issue-82-pre-main-rebase`

## Approved architecture

Use the existing Pi-resolved OAuth bearer for a pinned authenticated `GET /v1/user`; transiently validate `userId`; only then request pinned `GET /v1/billing?format=credits` with `x-userid`. Fail closed before billing on every identity error. Never persist/cache/log/display identity, authenticated headers, or raw bodies.

## Implementation map

- `extensions/xai/usage.ts`: bounded JSON transport/parser, safe rendering, `/xai-usage`, and session status controller.
- `extensions/xai/auth.ts`: pi-model-registry-only OAuth resolver for usage; unrelated active-model API keys and file fallbacks are excluded.
- `extensions/xai/constants.ts`: pinned URLs and usage limits.
- `extensions/xai-oauth.ts`: thin account/session/model/turn lifecycle wiring.
- `tests/fixtures/usage/*.json`: identity plus observed new/legacy credits shapes.
- `tests/usage/*.test.ts`: parser/bounds, identity-first transport/errors/cancellation, and command/status lifecycle.

## Validation state

- `/xai-usage` works as an explicit one-shot lookup without enabling background behavior.
- `/xai-usage status on` requires an active `xai-auth` model, refreshes immediately, then only after completed turns with a one-minute minimum interval.
- Any model/provider/account/session change disables and clears status. Non-xAI contexts never refresh.
- New `creditUsagePercent` and `currentPeriod` fields take precedence; legacy `used`/`monthlyLimit` and billing-period timestamps are conservative fallbacks.
- Missing optional fields are omitted. Unsupported/out-of-range optional fields are ignored; malformed root/history or over-limit structures fail safely.
- PR #89 has no reviews or review threads; its three conversation comments are bot usage-limit notices.
- The old policy failure was only the now-obsolete Pi 0.80.7 registry-drift check; merged PR #94 pins and validates 0.80.10.
- The original clean remote head was `53b8013`; it rebased onto `af31e83` as `9792282` plus `4c0f098`.
- Usage headers now live in the shared wire module, and stalled response bodies are explicitly bounded by cancellation/timeout races.
- Usage accepts only a resolver token that matches Pi's current stored OAuth credential after refresh, so stored/runtime API keys cannot be relabeled and sent to the CLI proxy.
- Cosmetic footer refreshes are detached from Pi's awaited turn lifecycle, malformed calendar timestamps are omitted, and unsuccessful bodies are cancelled.
- Caller/model `x-userid` is scrubbed globally and added only by the protected billing-header contract after bounded `/user` validation.
- Stored OAuth removal disables status before throttling; account/session resets abort and suppress stale one-shot or footer completions.
- Focused usage/provider/wire coverage passes 7 files / 74 tests; strict TypeScript, real loader, direct pack contract, and diff check pass.
- The final cumulative gate passes 37 files / 398 tests, 86.03% statement coverage, the 111-file pack contract, policy checks, and exact Pi 0.80.1/0.80.10 matrices.
- Independent security and final test re-reviews are clean.

## Delivery

The known old remote head was replaced with exact force-with-lease, PR #89's description was refreshed, and fresh policy, Socket, and exact Pi 0.80.1/0.80.10 checks are green. PR #89 remains open and unmerged: https://github.com/BlockedPath/pi-xai-oauth/pull/89
