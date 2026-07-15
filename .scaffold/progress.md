# Execution Progress

**Project:** pi-xai-oauth Repair + Tool Verification  
**Branch:** cursor/fix-page-keys-ten-items-7537
**Started:** 2026-05-27

## Phase: Issue #59 Page keys at ten items
- [x] Diagnosed modulo no-op in `moveSelection(±maxVisible)` when `options.length === 10`
- [x] Fixed `extensions/xai/tools/commands.ts` to fall back to ±1 when step would be 0
- [x] Added Composer 10-tool regression in `scripts/verify-extension.js`
- [x] Verified `npm run typecheck` and `npm test`
- [x] Opened PR #61 on `cursor/fix-page-keys-ten-items-7537`

## Completed
- [x] Created branch `feature/improved-agent-scaffolding`
- [x] Ran parallel scout + researcher agents for context and 2026 best practices
- [x] Created `AGENTS.md` (production-ready agent operations manual)
- [x] Created `.scaffold/plan.md` (detailed implementation roadmap)
- [x] Created `.scaffold/constraints.md` (hard rules and safety gates)
- [x] Created `.scaffold/progress.md` (this file)

## In Progress
- [x] Enhance `bin/setup.js` with --scaffold flag + robust generation
- [x] Added context.md generation + generic templates
- [x] Updated README.md with Agent Scaffolding section
- [x] Reviewed and fixed minor consistency issues
- [x] Fixed CLI issues: duplicate headers, missing --help, improved arg parsing, dynamic branch detection, scaffold-specific header

## Next Actions
1. Run `npx tsc --noEmit` (already clean)
2. [x] Test full --scaffold and --help flows (verified: clean output, no duplicates, new headers, skips existing files)
3. Run reviewer agent on changes
4. Commit with clear message
5. Consider creating a reusable scaffold template package

## Notes
This structure follows 2026 best practices: dedicated AGENTS.md, external persistent state, planning-first approach, and multi-agent delegation patterns.

Update this file frequently during execution.

## Phase 11: pi-ai 0.80 API compatibility
- [x] Created branch `codex/fix-pi-ai-080-api` after the 1.3.1 release checks exposed a removed root export.
- [x] Updated xAI Responses streaming and its guard verification to use `@earendil-works/pi-ai/api/openai-responses`.
- [x] Updated the Node 24 test callback to return a Promise as required by `assert.doesNotReject`.
- [x] Passed `npm test`, `npm run typecheck`, `git diff --check`, and `npm pack --dry-run` before preparing 1.3.2.

## Phase 5: Multi-Agent Integration
- [ ] Document preferred subagent usage patterns in AGENTS.md
- [ ] Create lightweight `scaffold-starter` template
- [ ] Add reviewer step in workflow
- [ ] Test parallel/chain subagent delegation

## Phase 6: Provider Payload Hook Repair
- [x] Diagnosed pi 0.74 provider errors after skill install: `before_provider_request` returned `{ payload }` instead of the replacement payload directly.
- [x] Patched `extensions/xai-oauth.ts` so sanitized provider requests are returned in the shape pi expects.
- [x] Removed the redundant global provider request hook so xAI sanitation stays inside the xAI provider stream path and does not mutate DeepSeek/Codex payloads.
- [x] Reinstalled the local package, cleared pi's Jiti cache, and verified provider smoke tests:
  - xAI now reaches the xAI API and returns an account/subscription 403 instead of `missing field input`.
  - DeepSeek returns `OK` instead of `missing field messages`.
  - OpenAI Codex returns `OK` instead of rejecting model `None`.

**Current branch:** feature/multi-agent-integration

## Phase 7: xAI Auth + Tool Parity Repair
- [x] Created current repair branch `codex/repair-xai-auth` from the detached worktree.
- [x] Audited provider/OAuth and custom tool paths with parallel subagents.
- [x] Hardened OAuth callback state handling so wrong or missing browser callback state cannot complete login.
- [x] Refreshes reused Grok CLI credentials before accepting them, and rejects expired credentials that cannot refresh.
- [x] Keeps xAI encrypted reasoning continuity in Responses payloads and preserves reasoning effort for Grok 4.20 reasoning.
- [x] Updated Grok model metadata/pricing and added `grok-4.20-multi-agent-0309`.
- [x] Reworked custom xAI tools to resolve OAuth via pi's model registry, remove `XAI_API_KEY` fallback, pass cancellation signals, and use native xAI `web_search`, `x_search`, and `code_interpreter` tools.
- [x] Updated image analysis and image generation request shapes, including `grok-imagine-image-quality`.
- [x] Added `scripts/verify-extension.js` plus `npm test` / `npm run typecheck` scripts.
- [x] Fixed README/setup drift and backed up malformed pi settings before rewriting.
- [x] Addressed final review findings: reload-safe tool registration, automatic Grok 4.20 reasoning handling, and correct multi-agent effort/accounting.
- [x] Verified:
  - `npm run typecheck`
  - `npm test`
  - `git diff --check`
  - `npm pack --dry-run`
  - `node bin/setup.js --help`
  - live local-extension DeepSeek smoke: `OK.`
  - live local-extension OpenAI Codex smoke: `OK`
  - live local-extension xAI smoke reaches xAI and returns account/subscription `403` instead of a payload/auth-shape error.

**Current branch:** codex/repair-xai-auth

## Phase 8: Post-Repair Tool Verification (this branch)
- [x] Synced local source to `codex/repair-xai-auth` (and main) via git setup
- [x] `npm install` + `npm test` ✅ (`verify-extension: ok`)
- [x] `pi install .` ✅
- [x] Verified all custom xAI tools via live calls:
  - `xai_x_search`, `xai_web_search`, `xai_critique`, `xai_generate_text` (grok-4.3 + reasoning), `xai_code_execution`
- [x] Confirmed OAuth provider, native tool shapes, no XAI_API_KEY fallback, and reasoning continuity all working
- [x] Initialized real git repo, switched to feature branch, updated docs
- [x] Working tree clean, up-to-date with `origin/main`

**Current branch:** feature/add-composer-2-5-models

## Phase 9: Add Composer 2.5 model selection
- [x] Created branch `feature/add-composer-2-5-models`.
- [x] Added `grok-composer-2.5-fast` and `grok-build` to the `xai-auth` provider model catalog.
- [x] Routed Grok CLI-only models through `https://cli-chat-proxy.grok.com/v1` with Grok CLI OAuth headers while keeping Grok 4.3/default models on `https://api.x.ai/v1`.
- [x] Updated custom tool request routing so `xai_generate_text` can use Composer 2.5/Grok Build model IDs.
- [x] Updated README/setup copy and verification coverage.
- [x] Added local `typescript` dev dependency so `npm run typecheck` resolves the real compiler and passes consistently.
- [x] Verified with `npm test`, `npm run typecheck`, `node bin/setup.js --help`, `git diff --check`, `npm pack --dry-run`, and `pi install .`.
- [x] Added README troubleshooting/updating guidance for duplicate npm/local/worktree installs causing `xai_*` tool conflicts.
- [x] Added Cursor/Grok CLI tool shims (`Read`, `Write`, `StrReplace`, `Edit`, `Delete`, `LS`, `Grep`, `Glob`, `Shell`, `WebSearch`) for Composer 2.5/Grok Build and model-scoped activation.
- [x] Added verification for shim registration, activation/deactivation, argument normalization, and Grep/Glob/Read/Write/StrReplace/Shell/Delete execution.
- [x] Documented Composer/Grok Build tool compatibility in README.

## Phase 10: Refactor xAI OAuth extension module structure
- [x] Created branch `feature/refactor-xai-oauth-modules` from clean `main`.
- [x] Proposed focused module split before editing.
- [x] Extracted xAI constants and model catalog/routing helpers into `extensions/xai/constants.ts` and `extensions/xai/models.ts`.
- [x] Verified first extraction slice with `npm test` and `npm run typecheck`.
- [x] Extracted OAuth login/refresh/callback handling into `extensions/xai/oauth.ts` and Grok credential/token resolution into `extensions/xai/auth.ts`.
- [x] Updated verification to accept model constants living under the new module structure.
- [x] Verified OAuth/auth extraction slice with `npm test` and `npm run typecheck`.
- [x] Extracted image normalization, response text/error helpers, Responses payload rewriting, and xAI request/stream helpers into `extensions/xai/images.ts`, `text.ts`, `payload.ts`, and `responses.ts`.
- [x] Verified payload/response extraction slice with `npm test` and `npm run typecheck`.
- [x] Extracted Cursor/Grok CLI shims and custom xAI tools into `extensions/xai/tools/`, leaving `extensions/xai-oauth.ts` as a thin provider/tools entrypoint.
- [x] Verified tool extraction slice with `npm test` and `npm run typecheck`.
- [x] Updated README and AGENTS architecture notes for the new module layout.
- [x] Final verification passed: `npm test`, `npm run typecheck`, `git diff --check`, and `npm pack --dry-run`.

## Phase 11: WSL OAuth manual-code repair
- [x] Created branch `feature/wsl-oauth-manual-code`.
- [x] Reproduced raw manual authorization code being misparsed as a query string and ignored for missing state.
- [x] Added OAuth verification coverage for raw pasted codes, matching-state manual callback URLs, and wrong-state manual queries.
- [x] Patched `parseCallbackInput()` to recognize raw xAI authorization codes before URL/query parsing.
- [x] Verified fix with `npm test`, `npm run typecheck`, and `git diff --check`.

## Phase 12: Issue 19 pi 0.79.8 API guard repair
- [x] Created branch `feature/issue-19-api-guard`.
- [x] Patched `extensions/xai/responses.ts` so `streamSimpleOpenAIResponses` receives a delegate model with `api: "openai-responses"` while xAI routing and payload hooks keep the `xai-responses` stream model.
- [x] Added regression coverage in `scripts/verify-extension.js` with a guarded mock of `streamSimpleOpenAIResponses`.
- [x] Verified with `npm test` and `npm run typecheck`.

**Current branch:** feature/issue-19-api-guard

## Phase 14: Issue 25 image parameter repair
- [x] Created isolated worktree on `codex/fix-issue-25-image-params` from `origin/main`.
- [x] Confirmed `xai_generate_image` always sent the unsupported `size` field and injected `n: 1` when omitted.
- [x] Removed `size` from the tool schema, rejected legacy explicit `size` calls locally, and made `n` opt-in.
- [x] Added regression coverage for default payload omission, explicit `n`, and no-request rejection of `size`.
- [x] Addressed reviewer feedback by enforcing the documented integer range for `n` in the schema and direct execution path.
- [x] Final verification passed: `npm test`, `npm run typecheck`, and `git diff --check`.

**Current branch:** codex/fix-issue-25-image-params

## Phase 13: Issue 19 real-package verification and 1.2.4 release staging
- [x] Staged docs for the `pi-xai-oauth` 1.2.4 update path covering published npm installs and local checkout reinstalls.
- [x] Recorded that the issue 19 verification work now targets the real pi 0.79.x API guard instead of a mocked guard.
- [x] Intended development dependency pins for the verification branch: `@earendil-works/pi-ai@^0.79.8` and `@earendil-works/pi-coding-agent@^0.79.8`.
- [x] `npm install` resolved both pi packages to 0.79.8 and added direct `jiti@^2.7.0` for the verification loader.
- [x] Replaced the mocked API-guard regression with real-package guard coverage that handles synchronous guard throws and `result.errorMessage`.
- [x] Adapted Cursor/Grok CLI shims for pi-coding-agent 0.79.8 by avoiding external `rg`/`fd` downloads in the compatibility shim tests.
- [x] Verified final branch with `npm test`, `npm run typecheck`, and `node bin/setup.js --help`.
- [x] `npm pack --dry-run` confirmed the 1.2.4 tarball excludes agent worktrees/state.
- [ ] `npm publish` is blocked by npm one-time-password authentication; rerun after completing npm CLI auth.

**Current branch:** feature/issue-19-api-guard

## Phase 15: Add Grok 4.5 model catalog support
- [x] Created branch `feature/add-grok-4-5`.
- [x] Researched official xAI Grok 4.5 docs, pricing, reasoning, launch notes, and card/paper availability.
- [x] Added `grok-4.5` to `extensions/xai/models.ts` with text+image input, reasoning support, 500K context, and $2/$0.50 cached/$6 pricing.
- [x] Made `grok-4.5` the default model in constants, setup, and README showcase.
- [x] Hardened Grep Cursor shim: TypeBox required `pattern`, clearer errors, query alias mapping.
- [x] Improved Responses `prompt_cache_key` / `x-grok-conv-id` routing per xAI caching docs.
- [x] Updated README, setup copy, package description, and verification coverage for Grok 4.5.
- [x] Verified with `npm test`, `npm run typecheck`.

**Current branch:** feature/add-grok-4-5

## Phase 18: Issue 47 compat dispatcher isolation
- [x] Replaced global compat `streamSimple` dispatch with the builtin `openAIResponsesApi()` provider stream.
- [x] Added regression coverage that registers a conflicting `openai-responses` compat provider and verifies xAI bypasses it.
- [x] Final verification passed: `npm test`, `npm run typecheck`, and `git diff --check`.

## Phase 16: npm/local package conflict repair
- [x] Created branch `fix/dedupe-local-package-install`.
- [x] Fast-forwarded branch onto latest `origin/main` (`00db405`, v1.3.0).
- [x] Reproduced `pi` startup tool conflicts when user settings contained both `../../projects/pi-xai-oauth` and `npm:pi-xai-oauth`.
- [x] Added setup-script package pruning helpers to remove duplicate local installs of this package when installing the npm package.
- [x] Added setup regression coverage for npm spec parsing, local duplicate pruning, and settings rewrite behavior.
- [x] Removed the duplicate local package entry from `~/.pi/agent/settings.json` to unblock this machine while preserving the npm default `grok-4.5`.
- [ ] Re-verify on latest main: `npm test`, `npm run typecheck`, `git diff --check`, `node bin/setup.js --help`, `npm pack --dry-run`.

## Phase 17: Issue 40 Cursor shim leakage repair
- [x] Routed Cursor shim synchronization through the pi `ExtensionAPI` active-tool registry.
- [x] Added regression coverage for realistic event contexts, model switching, idempotency, and transient registry failures.
- [x] Targeted shim checks and `git diff --check` pass; committed and pushed as PR #41, with PRs #37 and #38 superseded.
- [x] Full `npm test` / `npm run typecheck` remain blocked by the pre-existing pi 0.80.3 `streamSimpleOpenAIResponses` API mismatch in `responses.ts`.

**Current branch:** codex/fix-issue-40-cursor-shims

## Phase 18: pi 0.80 extension-loader subpath repair
- [x] Reproduced pi's root alias rewriting `@earendil-works/pi-ai/api/openai-responses` to the invalid `compat.js/api/openai-responses` path.
- [x] Routed Responses streaming through the supported `@earendil-works/pi-ai/compat` dispatcher.
- [x] Verified unit/setup tests, TypeScript diagnostics, and an actual pi extension-loader stream probe.
- [x] Bumped the npm package and lockfile to 1.3.3 and updated release guidance.

## Phase 19: GitHub issues #49 and #50
- [x] Read both issue reports and confirmed neither has follow-up comments or an existing fix PR.
- [x] Replaced the stale merged worktree branch with `feature/issues-49-50` at current `origin/main` (`0f1ad5a`).
- [x] Ran parallel read-only investigations for paid-search guarding and image replay/transport mitigation.
- [x] Confirmed baseline `npm test` and `npm run typecheck` pass before source edits.
- [x] Implemented issue #49 search/research tool opt-in, active-model execution guards, model-switch cleanup, and active-model routing.
- [x] Implemented issue #50 consumed-image lifecycle, 3 MiB aggregate inline-image compaction, local overflow failure, and xAI error naming.
- [x] Added regression coverage for lifecycle registry retries, zero-network guard failures, active routing, image replay boundaries, compaction, and direct/stream transport.
- [x] Addressed reviewer findings covering the capital `WebSearch` bypass, fail-open registry errors, post-compaction payload-hook mutation, and MIME documentation.
- [x] Independent closure review reported no remaining findings.
- [x] Final validation passed: `npm test`, `npm run typecheck`, `git diff --check`, `npm pack --dry-run`, real pi extension loading, and real pi session/model lifecycle probes.

**Current branch:** feature/issues-49-50

## Phase 20: Issue 52 package-owned paid-tool command
- [x] Confirmed core pi 0.80.7 does not include `/tools`; that command exists only in an optional example extension.
- [x] Added package-owned `/xai-tools` interactive selection plus `status`, `enable`, and `disable` arguments.
- [x] Kept paid tools off at session start, removed them outside xAI models, and restricted `WebSearch` to Grok Build/Composer.
- [x] Replaced misleading README, tool-description, and runtime-error references to pi's `/tools` picker.
- [x] Added regression coverage for command registration, model eligibility, explicit toggling, lifecycle persistence, and fail-closed registry errors.
- [x] Verified real pi 0.80.7 RPC registration, default-disabled status, explicit enablement, and credit warning.
- [x] Fixed independent review finding by tracking explicit authorization per paid tool and stripping stale unauthorized tools after registry recovery.
- [x] Focused closure review reported no findings.
- [x] Final validation passed: `npm test`, `npm run typecheck`, `git diff --check`, `npm pack --dry-run`, and real pi 0.80.7 RPC command probes.

**Branch:** feature/issue-52-xai-tools

## Phase 21: Issue 54 all-network-tool opt-in policy
- [x] Audited every custom xAI tool and separated outbound API helpers from local Cursor/Grok CLI shims.
- [x] Generalized the package-owned activation catalog and lifecycle guard from search-only tools to all ten network-backed helpers.
- [x] Added pre-auth execution guards and explicit-user-intent guidance to text generation, code execution, image generation, critique, and image analysis.
- [x] Expanded `/xai-tools` with category and cost-risk context, including `xai_generate_image`.
- [x] Documented that normal xAI chat and local shims remain available without enabling outbound helpers.
- [x] Added regression coverage for catalog completeness, default inactivity, credential/network fail-closed behavior, image opt-in, model switching, session reset, registry recovery, and command UX.
- [x] Passed `npm test`, `npm run typecheck`, `git diff --check`, and `npm pack --dry-run`.
- [x] Verified through pi's real extension loader/RPC mode that `/xai-tools` registers and reports every network-backed tool disabled for a standard xAI model.
- [x] Independent closure review reported no findings.

**Current branch:** feature/issue-54-paid-xai-tools

## Phase 22: npm patch release 1.3.4
- [x] Synced merged PR #55 into local `main`.
- [x] Created `feature/release-1.3.4`.
- [x] Bumped package and lockfile versions to 1.3.4.
- [x] Updated README release notes and npm upgrade guidance.
- [x] Added a narrow npm exclusion so local pi session HTML exports cannot leak into releases.
- [x] Passed `npm test`, `npm run typecheck`, `git diff --check`, and `npm pack --dry-run`.
- [x] Confirmed the 1.3.4 tarball excludes the untracked session export.
- [x] Confirmed npm served 1.3.3 before publication.
- [x] Confirmed npm authentication as `blockedredemption`.
- [x] Committed and merged release PR #56, then published and verified `pi-xai-oauth@1.3.4` as `latest`.

**Current branch:** feature/release-1.3.4

## Phase 23: Preserve /xai-tools picker focus
- [x] Confirmed repeated `ctx.ui.select()` calls reset the TUI cursor to row one.
- [x] Added a persistent custom TUI picker that toggles the highlighted tool in place.
- [x] Kept the existing selection loop as the RPC fallback.
- [x] Added regression coverage for cursor preservation, Escape close, activation, and RPC behavior.
- [x] Updated README controls.
- [x] Passed `npm test`, `npm run typecheck`, `git diff --check`, and `npm pack --dry-run`.
- [x] Completed focused review of TUI navigation, toggling, close behavior, and RPC fallback.

**Current branch:** feature/xai-tools-picker-focus

## Phase 24: npm patch release 1.3.5
- [x] Bumped package and lockfile versions from 1.3.4 to 1.3.5.
- [x] Updated README release and npm upgrade guidance for the picker-focus fix.
- [x] Confirmed npm still serves 1.3.4 and 1.3.5 is available for publication.
- [x] Excluded the unrelated local `cat.svg` artifact from npm packages without modifying the file.
- [x] Passed tests, typecheck, diff checks, and 1.3.5 tarball inspection.
- [x] Committed and pushed the release update to PR #57.

**Current branch:** feature/xai-tools-picker-focus

## Phase 25: Versioned changelog
- [x] Confirmed npm publication dates, `gitHead` values, and the published-version list through 1.3.5.
- [x] Audited exact Git ranges between published revisions for notable user-facing changes.
- [x] Added `CHANGELOG.md` with detailed modern releases and a grouped early-history summary.
- [x] Linked the changelog from the README introduction and table of contents.
- [x] Corrected release assignments using npm `gitHead` ranges rather than version strings alone.
- [x] Passed changelog structure, README link, `git diff --check`, `npm test`, `npm run typecheck`, and npm tarball checks.
- [x] Committed, pushed, and opened the changelog PR.

**Current branch:** feature/changelog
