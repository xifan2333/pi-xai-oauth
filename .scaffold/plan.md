# Implementation Plan: GitHub Issue #54

**Branch:** feature/issue-54-paid-xai-tools

**Date:** 2026-07-15

**Goal:** Make image generation and every other network-backed xAI helper a model-scoped explicit opt-in, with one package-owned activation policy and fail-closed execution guards.

## Phase 1: Audit and policy
- [x] Read issue #54 and audit every registered custom xAI and Cursor/Grok CLI tool.
- [x] Run clean baseline tests and TypeScript validation.
- [x] Independently confirm the policy boundary: extra xAI requests require opt-in; local shims remain automatic.

## Phase 2: Activation boundary
- [x] Expand the package-owned catalog to all ten network-backed xAI tools.
- [x] Require an active eligible xAI model plus per-tool package authorization.
- [x] Guard every custom executor before OAuth credential lookup or network access.
- [x] Reset authorization on session start and when leaving xAI; never silently restore it.
- [x] Keep `WebSearch` restricted to Grok Build/Composer models.

## Phase 3: UX, documentation, and verification
- [x] Add category and cost-risk context to `/xai-tools`.
- [x] Add explicit-user-intent guidance, especially for `xai_generate_image`.
- [x] Document the activation policy for every tool and distinguish automatic local shims.
- [x] Add catalog-completeness, no-auth/no-network, lifecycle, command, and image-generation regressions.
- [x] Run final tests, package checks, and a real pi loader/RPC smoke.
- [x] Complete independent diff review with no findings.

**Owner:** Main agent

**Next action:** Hand off the completed branch for commit or PR publication.
