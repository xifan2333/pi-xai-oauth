# Constraints & Safety Rules — Issue #132

## Scope

- Broaden only network-tool eligibility and managed credential/usage lookup to Pi's built-in `xai` provider.
- Keep `XAI_PROVIDER_ID` as the package-owned `xai-auth` provider identity.

## Must

- Prefer the active compatible provider when searching `xai-auth` and `xai` credentials.
- Route built-in SuperGrok OAuth as `oauth-session` and built-in API keys as `api-key`.
- Keep usage OAuth-only, bounded, identity-first, and inactive for an active built-in API key.
- Clear network-tool opt-ins when switching to a non-compatible provider.
- Preserve exact supported Pi boundaries and existing Grok CLI credential reuse.

## Must not

- Register, replace, unregister, refresh, or stream the built-in `xai` provider.
- Broaden package catalog, entitlement, vision-routing, or local Grok-adapter checks beyond `xai-auth`.
- Send built-in API keys through the CLI session proxy or usage endpoints.
- Work on issues #130 or #131.
- Log, persist, or expose credentials, identity, authenticated headers, or raw authenticated bodies.
