# Constraints & Safety Rules — Issue #93

## Hard boundaries

- Keep Pi peers at `>=0.80.1 <0.81.0` and the minimum at 0.80.1.
- Adopt 0.80.10 only after clean packed candidate validation and release review.
- Keep both exact Pi dev dependencies, policy latest, and lockfile aligned.
- Preserve the synchronous, read-only startup credential lookup on both supported boundaries.
- Do not weaken OAuth, catalog, routing, credential-lock, privacy, or test-isolation behavior.
- Never make live xAI calls or log credentials, codes, tokens, authenticated bodies, or headers.

## Validation

- Run focused regressions, full tests, coverage, typecheck, policy/registry/pack checks, and exact packed 0.80.1/0.80.10 matrices.
- Verify strict peer diagnostics and the real extension loader from the packed package.
- Use one writer; parallel agents are review-only.

## Delivery

- Update progress after major phases.
- Commit and push only after clean validation and independent review.
- Open a PR against main; do not merge it.
