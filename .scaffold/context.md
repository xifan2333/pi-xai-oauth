# Shared Agent Context — Issue #114

**Issue:** https://github.com/BlockedPath/pi-xai-oauth/issues/114
**Branch:** `fix/114-post-hook-vision-pruning`
**Base:** `origin/main` at `941cb4a`

## Root Cause

`rewriteXaiResponsesPayload` removed consumed historical images before the caller's
`onPayload` hook, but the canonical hook result went directly to vision planning. A
hook could therefore reconstruct historical user images or computer screenshots and
send them to the vision target.

## Implementation

- `extensions/xai/payload.ts` exports a focused, structural consumed-history helper.
- The ordinary rewrite and canonical post-hook boundary share that helper.
- Post-hook pruning is gated by the grant captured when streaming began.
- Current images remain available for routing; disabled routing still fails closed.
- Screenshot output remains `{ type: "computer_screenshot" }` with call identity retained.
- Consumed items are recursively scrubbed using the same image-shape taxonomy as route planning.

## Validation State

The recursive fix passes focused and full tests, TypeScript, compatibility policy/pack
checks, and exact Pi 0.80.1 / 0.80.10 boundary matrices. Final fresh-context review
is clean.
