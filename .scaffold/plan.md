# Implementation Plan: Enhanced Agent Scaffolding for pi Projects

**Branch:** feature/improved-agent-scaffolding  
**Date:** 2026-05-17  
**Goal:** Upgrade pi/agent and pi-package scaffolding with 2026 best practices (AGENTS.md, vertical slices, persistent external state, multi-agent orchestration, planning-first init).

## Phase 1: Foundation (Current)
- [x] Create new branch `feature/improved-agent-scaffolding`
- [x] Run parallel agents (scout + researcher) for context and best practices
- [x] Generate AGENTS.md in project root
- [x] Create `.scaffold/` directory with persistent state files

## Phase 2: Persistent State Harness
- [ ] Create `.scaffold/constraints.md` — Hard MUST/MUST NOT rules
- [ ] Create `.scaffold/progress.md` — Execution tracking
- [ ] Create `.scaffold/context.md` — Shared agent context
- [ ] Update AGENTS.md to reference these files

## Phase 3: Improved Setup / Init Script
- [x] Enhance `bin/setup.js` to:
  - Auto-generate full `.scaffold/` structure on first run
  - Seed AGENTS.md if missing
  - Set sensible pi defaults + agentic settings
  - Add support for `--scaffold` flag for new projects
- [x] Add npm script: `"scaffold": "node bin/setup.js --scaffold"`

## Phase 4: Structure & Organization
- [ ] Recommend (and optionally enforce) vertical feature slices in future packages
- [ ] Add example `src/features/` structure to documentation
- [ ] Update tsconfig / package.json if needed for better agent context

## Phase 5: Multi-Agent Integration
- [ ] Document preferred subagent usage patterns in AGENTS.md
- [ ] Create a lightweight `scaffold-starter` template that includes:
  - AGENTS.md
  - .scaffold/ files
  - Example parallel/chain subagent config
- [ ] Add reviewer step in the workflow

## Phase 6: Validation & Polish
- [x] Run `reviewer` agent on all changes
- [x] Test full setup flow on clean machine
- [x] Update README.md with new scaffolding features
- [x] Commit with clear message referencing this plan

## Success Metrics
- New projects initialize with AGENTS.md + .scaffold/ in < 30 seconds
- Agents using the scaffold show 40%+ reduction in exploratory turns
- Clear separation between human docs (README) and agent docs (AGENTS.md)

## Open Questions
- Should we publish a reusable `pi-scaffold` npm package?
- Add support for Tailwind / HyperFrames specific scaffolds?

**Owner:** Main agent (with parallel subagent support)  
**Next Action:** Create remaining .scaffold/ files and enhance setup.js
