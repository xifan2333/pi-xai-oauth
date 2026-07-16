# Shared Agent Context — Issue #66

**Project:** pi-xai-oauth
**Branch:** feature/issue-66-device-code-auth
**Date:** 2026-07-16

## Issue Contract
Add device authorization as a clear `/login xai-auth` option for SSH, WSL, containers, remote workspaces/VMs, and human-operated headless sessions. Browser authorization-code + PKCE remains the normal desktop default.

## Authoritative Protocol
- Device endpoint: `https://auth.x.ai/oauth2/device/code`.
- Token endpoint: `https://auth.x.ai/oauth2/token`.
- Client ID: existing `b1a00492-073a-47ea-816f-4c329264a828`.
- Scopes: existing ordered `openid profile email offline_access grok-cli:access api:access conversations:read conversations:write`.
- Initiation is form-encoded `client_id`, `scope`, and truthful referrer/metadata; polling is form-encoded device grant URN, opaque `device_code`, and client ID.
- Sleep before the first request; default omitted interval to 5 seconds, floor to 1 second, preserve pending cadence, and add 5 seconds cumulatively on `slow_down`.
- Honor positive server `expires_in` and cap total flow at 15 minutes. This intentionally follows RFC/pi bounded expiry rather than the pinned official client's 10-minute minimum-floor quirk.

## Pi Runtime Contract
- `onSelect` preserves provider option order and highlights index zero; selector cancellation returns `undefined` without aborting.
- `onDeviceCode` displays a clickable verification URL, user code, waiting text, and cancel hint; the provider owns polling.
- Dialog cancellation aborts `callbacks.signal`; device initiation, sleep, polls, and catalog handoff must consume it.
- `AuthStorage.login` persists only after provider login resolves, so rejection/cancellation preserves existing pi credentials.
- `usesCallbackServer` remains enabled provider-wide for browser/manual redirect input; device mode avoids `onAuth` and manual input.

## Preservation Boundaries
Browser state/raw-code/PKCE/OIDC validation from #67; scopes/proxy headers from #65; credential-aware routing from #63/#70; exact authenticated catalog/cache/account isolation from #64/#73; and refresh-token rotation/preservation all remain unchanged.

## Delivery
Reviewed implementation commit `9968f3b` was pushed on `feature/issue-66-device-code-auth`; unmerged PR #75 targets `main` and closes issue #66: https://github.com/BlockedPath/pi-xai-oauth/pull/75

No live device flow was attempted. Deterministic protocol, registered-provider/catalog, and real pi AuthStorage integration tests validated behavior without touching existing credentials.

## Research Artifacts
- `/tmp/issue66-official-research.md`
- `/tmp/issue66-local-scout.md`
- `/tmp/issue66-pi-context.md`
- `/tmp/issue66-plan-review.md`
- `/tmp/issue66-oracle.md`
