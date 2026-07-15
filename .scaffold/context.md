# Shared Agent Context

**Project:** pi-xai-oauth
**Branch:** feature/issues-49-50
**Date:** 2026-07-15

## Key Context
- This project provides xAI OAuth + Grok 4.5 and related Grok models for pi agents.
- Use subagent tool for delegation.
- Persistent state lives in .scaffold/.

## Current Focus
- GitHub #49: xAI paid search/research tools must be explicit opt-ins, guarded by the active `xai-auth` model, and routed through that model.
- GitHub #50: consumed historical tool images must not be replayed; oversized current inline images need high-fidelity transport compaction and a hard aggregate budget.
- Preserve OAuth-only behavior and never log credentials or inline image data.

See plan.md for active phases and progress.md for completed verification.
