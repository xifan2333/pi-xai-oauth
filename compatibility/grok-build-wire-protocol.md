# Grok Build wire-protocol compatibility

This document records the xAI request contract reviewed for issue [#78](https://github.com/BlockedPath/pi-xai-oauth/issues/78). It is a compatibility audit, not a claim that `pi-xai-oauth` is the official Grok client.

## Last reviewed upstream revision

- Repository: `xai-org/grok-build`
- Commit: `b189869b7755d2b482969acf6c92da3ecfeffd36`
- Upstream commit date: 2026-07-15
- Local implementation: `extensions/xai/wire.ts`

Pinned source starting points:

- [Per-request identity headers](https://github.com/xai-org/grok-build/blob/b189869b7755d2b482969acf6c92da3ecfeffd36/crates/codegen/xai-grok-sampler/src/client.rs#L35-L76)
- [Default auth, client, version, and User-Agent headers](https://github.com/xai-org/grok-build/blob/b189869b7755d2b482969acf6c92da3ecfeffd36/crates/codegen/xai-grok-sampler/src/client.rs#L399-L496)
- [Proxy-specific injected headers](https://github.com/xai-org/grok-build/blob/b189869b7755d2b482969acf6c92da3ecfeffd36/crates/codegen/xai-grok-shell/src/agent/mvp_agent/mod.rs#L1148-L1190)
- [Responses defaults and dispatch](https://github.com/xai-org/grok-build/blob/b189869b7755d2b482969acf6c92da3ecfeffd36/crates/codegen/xai-grok-sampler/src/client.rs#L1081-L1160)

The upstream sampler posts paths relative to a configured base URL. That does not authorize this package to accept caller-, model-, or catalog-provided origins. The endpoint policy below remains pinned in source.

## Identity and version policy

These values have separate meanings and must not be conflated:

| Value | Local policy |
|---|---|
| `x-grok-client-identifier` | Always the truthful npm package name, `pi-xai-oauth`. |
| `User-Agent` | Always `pi-xai-oauth/<package version>`. |
| `x-grok-client-version` | The installed `pi-xai-oauth` package version. It is the only truthful controlled version available to this third-party client. |
| Reviewed Grok Build revision | Stored separately as the commit above. It is documentation/audit metadata and is not sent as product identity. |

The reviewed source treats `x-grok-client-version` as a proxy gate input, but it does not define an authoritative third-party protocol-version value. This package therefore does not copy a `grok-shell`, crate, or official binary version merely to pass a server gate. A gate rejection produces an actionable status-only error asking the user to update this package or open a compatibility issue.

## Pinned route and header matrix

All listed headers are internally owned. Caller/model headers are scrubbed case-insensitively before the route contract is appended.

| Request | Pinned route | Required contract | Explicit exclusions |
|---|---|---|---|
| Browser authorization | `https://auth.x.ai/oauth2/authorize` | PKCE S256, state, nonce, pinned client ID/scopes/redirect | No bearer or CLI-proxy headers |
| Device initiation | `https://auth.x.ai/oauth2/device/code` | JSON accept, form content type, truthful User-Agent, client version/surface | No bearer or CLI-proxy headers |
| Browser/device/refresh token | `https://auth.x.ai/oauth2/token` | JSON accept, form content type, truthful User-Agent, client version/surface | No CLI-proxy headers; no response-body reflection |
| OIDC discovery/JWKS | Pinned issuer discovery and JWKS URLs | JSON accept, redirect rejection, issuer/algorithm/key validation | No bearer, caller endpoint, or proxy metadata |
| OAuth model catalog | `https://cli-chat-proxy.grok.com/v1/models-v2` | Bearer, JSON accept, truthful identity/version/User-Agent, token-auth, authenticate-response, client mode | No conversation, request, model, session, agent, turn, user, or deployment IDs |
| OAuth streaming Responses | `https://cli-chat-proxy.grok.com/v1/responses` | Bearer, JSON content, `Accept: text/event-stream`, truthful identity/version/User-Agent, proxy auth, client mode, conversation/request/model/session metadata, redirect rejection | No unsupported identity IDs, generic SDK affinity IDs, or caller route |
| OAuth direct Responses | `https://cli-chat-proxy.grok.com/v1/responses` | Same proxy metadata with `Accept: application/json` and redirect rejection | No SSE accept, unsupported identity IDs, or generic SDK affinity IDs |
| API-key direct Responses | `https://api.x.ai/v1/responses` | Bearer, JSON accept/content, truthful User-Agent, redirect rejection | No CLI-proxy metadata or generic SDK affinity IDs |
| OAuth or API-key image generation | `https://api.x.ai/v1/images/generations` | Bearer, JSON accept/content, truthful User-Agent, redirect rejection | No CLI-proxy metadata |

### Header classification

- Always internally owned: `Authorization`, `Accept`, `Content-Type`, `User-Agent`, every `x-grok-*` header, `X-XAI-Token-Auth`, and `x-authenticateresponse`.
- Proxy-route authentication: `X-XAI-Token-Auth: xai-grok-cli` and `x-authenticateresponse: authenticate-response`.
- Truthful attribution/gating: `x-grok-client-identifier`, `x-grok-client-version`, and `User-Agent`.
- Route mode: `x-grok-client-mode`, resolved as `interactive` only for a text TTY and `headless` for print/JSON/RPC/non-TTY operation.
- Streaming only: `Accept: text/event-stream`.
- Affinity/routing metadata: conversation, request, model override, and session IDs on OAuth Responses only.
- Unsupported: agent, turn, deployment, and user IDs. Unknown caller-supplied `x-grok-*` names are rejected. Generic delegate affinity headers (`session_id`, `x-client-request-id`, and `x-session-id`) are suppressed so only the reviewed xAI conversation/request/session fields leave the process.

## ID ownership

- Normal Pi streams use Pi's `sessionId` as both `x-grok-conv-id` and `x-grok-session-id`.
- If Pi supplies no session ID, the extension generates one UUID and uses it for both affinity fields.
- Direct Responses helpers generate one UUID per helper request for conversation/session affinity.
- Every actual Responses HTTP attempt gets a fresh `x-grok-req-id` UUID.
- `x-grok-model-override` comes only from the normalized selected/requested model ID.
- `x-grok-agent-id` is omitted because upstream treats it as a persistent runtime/machine identity and Pi does not provide an equivalent consented value.
- `x-grok-turn-idx` is omitted because Pi does not expose one authoritative value through all streaming and direct helper paths.
- Deployment and user IDs are never derived from OAuth credentials, identity tokens, catalog bodies, or local machine state.

## Privacy and failure policy

The header sanitizer removes authorization, accept/content type, User-Agent, proxy auth, generic SDK affinity IDs, and every caller-provided `x-grok-*` value before adding the approved route contract. This prevents client impersonation and privacy-sensitive ID injection while preserving unrelated non-reserved headers. Responses and media POSTs reject redirects before fetch can replay request bodies or metadata to another origin.

Unsuccessful direct HTTP responses are read through a 16 KiB bound for classification only. Raw response bodies, request headers, credentials, and request bodies are never included in the thrown/displayed message. Errors preserve HTTP status and route classification. Proxy version-gate signals return stable update/report guidance and the last reviewed revision; they do not recommend copying an official Grok version.

Catalog, OAuth, OIDC, and device paths retain their existing stricter endpoint, response-size, cancellation, and secret-redaction rules.

## Encrypted reasoning boundary (#79)

Issue [#79](https://github.com/BlockedPath/pi-xai-oauth/issues/79) owns implementation of encrypted reasoning. The reviewed contract area is:

- default `store` to `false` when the verified Responses policy permits it;
- request `reasoning.encrypted_content` exactly once;
- retain the complete typed reasoning item, including its opaque encrypted content;
- replay that item verbatim and inline at its original conversation position;
- preserve stable serialized prefixes across later turns;
- never render, inspect, transform, log, cache outside the Pi session, or send encrypted content across provider/endpoint/model-family boundaries;
- treat encrypted-content/model-family mismatch as terminal and actionable.

Issue #78 does not change payload include handling, conversation persistence, typed reasoning retention, replay ordering, or mismatch retry behavior. Those changes and their persistence/provider-switching fixtures remain deferred to #79.

## Repeatable upstream review procedure

1. Select an immutable Grok Build commit; never review a moving branch label.
2. Fetch the relevant files at that exact revision:

   ```bash
   REV=b189869b7755d2b482969acf6c92da3ecfeffd36
   gh api -H 'Accept: application/vnd.github.raw+json' \
     "repos/xai-org/grok-build/contents/crates/codegen/xai-grok-sampler/src/client.rs?ref=$REV"
   gh api -H 'Accept: application/vnd.github.raw+json' \
     "repos/xai-org/grok-build/contents/crates/codegen/xai-grok-shell/src/agent/mvp_agent/mod.rs?ref=$REV"
   gh api -H 'Accept: application/vnd.github.raw+json' \
     "repos/xai-org/grok-build/contents/crates/codegen/xai-grok-sampling-types/src/conversation.rs?ref=$REV"
   ```

3. Reclassify every changed header as internally required, route-specific, streaming-only, affinity, optional attribution, or unsupported. Trace where upstream values originate; do not assume the sampler generates IDs it only forwards.
4. Re-audit `extensions/xai/constants.ts`, `routing.ts`, `wire.ts`, `responses.ts`, `catalog.ts`, `oauth.ts`, and `device-auth.ts`. Preserve pinned origins unless a separate security review explicitly changes them.
5. Update the reviewed revision and this matrix only after request-shape/privacy tests cover the new behavior.
6. Run:

   ```bash
   npm run test:unit -- tests/responses/routing.test.ts tests/catalog/cache.test.ts tests/oauth/browser-login.test.ts tests/oauth/refresh.test.ts tests/oauth/device-initiation.test.ts tests/oauth/device-polling.test.ts
   npm run typecheck
   npm test
   npm run compatibility:boundaries
   ```

7. Record any encrypted-reasoning change in #79 rather than folding it into an unrelated header review.
