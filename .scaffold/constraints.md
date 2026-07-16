# Constraints & Safety Rules — Issue #68

## Hard boundaries

- Do not change OAuth, catalog, routing, streaming, image, or tool runtime behavior except a minimal typed testability seam that receives independent review.
- Do not delete legacy assertion code until its destination tests pass and the parity checklist is checked.
- Keep browser PKCE/state/nonce/OIDC and device endpoint/timing/cancellation/redaction policies intact.
- Keep compatibility verification and npm resolver/package checks in plain Node.
- Keep Pi peers at `>=0.80.1 <0.81.0` and exact dev/matrix endpoints 0.80.1/0.80.7.
- Never make live xAI calls or log credentials, codes, device codes, tokens, state, nonce, authenticated bodies, or headers.
- Never weaken unhandled rejection behavior or inflate coverage thresholds without measured evidence.

## Required isolation

- Fresh fetch router, ExtensionAPI harness, credentials, active-tool registry, and temp filesystem per test.
- Restore global fetch, timers/system time, environment, cwd, mocks, runtime models, module state, streams, callback listeners, and servers in reliable cleanup.
- Real callback/loader tests are serial and use real timers.
- Unit tests, config, fixtures, and loader smoke must ship in the npm tarball because compatibility matrices run from the packed package.

## Delivery

- One writer in the active worktree; read-only parallel reviewers.
- Update progress after major phases.
- Commit and push only after all requested validation and clean independent review.
- Open a PR against main; do not merge it.
