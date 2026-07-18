# Execution Progress — Restore Grok 4.3 OAuth visibility

**Branch:** `feature/restore-grok-4-3-oauth`

## Completed

- [x] Confirmed pi's fresh normalized OAuth cache contains only `grok-4.5`.
- [x] Confirmed the official Grok CLI's newer authenticated `models_cache.json` also contains only `grok-4.5`.
- [x] Verified no local normalization or hidden-entry filter dropped Grok 4.3.
- [x] Reviewed current xAI model documentation: Grok 4.3 remains a distinct public request model.
- [x] Ran one bounded authenticated OAuth Responses probe without logging credentials or raw bodies; HTTP 200 completed and reported response model `grok-4.3`.
- [x] Added `XAI_MODEL_ENTITLEMENT_COMPATIBILITY` separately from canonical aliases, mapping the proven Grok 4.3 request route to the present Grok 4.5 entitlement source.
- [x] Added Grok 4.3 none/low/medium/high reasoning metadata while retaining authenticated modality evidence and conservative source context limits.
- [x] Added focused expansion, canonicalization, non-recursion, runtime entitlement, and metadata assertions.
- [x] Confirmed `pi -e . --list-models xai-auth` now lists `grok-4.3` at a conservative 500K context.
- [x] Updated README and AGENTS policy wording.

## Validation

- [x] Focused model suite: 20 tests passed.
- [x] Primary TypeScript LSP diagnostics: zero findings.
- [x] `git diff --check`.
- [x] Full `npm test`: 413 tests plus real loader smoke passed.
- [x] `npm run typecheck`.
- [x] `npm run test:coverage`: all configured V8 floors passed.
- [x] `npm run compatibility:check`: packed manifest and peer policy passed.
- [x] `npm run compatibility:boundaries`: exact Pi 0.80.1 and 0.80.10 suites/typecheck passed.

## Residual constraints

- The exact cache never stores Grok 4.3 unless xAI itself returns it.
- Grok 4.3 remains distinct from Grok 4.5 for outbound requests and canonical resolution.
- Unverified `grok-latest` / `grok-4.3-latest` compatibility is not inferred from the Grok 4.3 probe.
- `.claude/` is unrelated untracked state and must not be committed.
