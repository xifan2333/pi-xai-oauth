# Shared Agent Context

**Project:** pi-xai-oauth
**Branch:** feature/issue-52-xai-tools
**Date:** 2026-07-15

## Key Context
- This project provides xAI OAuth + Grok 4.5 and related Grok models for pi agents.
- Use subagent tool for delegation.
- Persistent state lives in .scaffold/.

## Current Focus
- GitHub #52: provide a package-owned `/xai-tools` command because core pi does not ship the optional `/tools` example.
- Paid search tools remain session-scoped explicit opt-ins and fail closed outside active eligible `xai-auth` models.
- Runtime messages and README instructions must point only to the command this package actually registers.

See plan.md for active phases and progress.md for completed verification.
