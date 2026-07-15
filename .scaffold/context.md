# Shared Agent Context

**Project:** pi-xai-oauth
**Branch:** feature/changelog
**Date:** 2026-07-15

## Key Context
- GitHub #54 reported that `xai_generate_image` was paid, active by default, absent from `/xai-tools`, and unguarded.
- The audit found the same boundary defect in `xai_generate_text`, `xai_code_execution`, `xai_analyze_image`, and `xai_critique`.
- Every helper that sends an additional xAI request is now a session-scoped explicit opt-in.
- Local filesystem and shell compatibility shims remain automatic for eligible Grok CLI models because they do not make an extra xAI request.
- `WebSearch` remains opt-in and is eligible only for Grok Build/Composer models.
- Disabled tools must fail before OAuth credential resolution or network access.

## Current Focus
- Add a durable version-by-version changelog grounded in Git and npm history.
- Keep the README focused on current usage while linking to historical release details.
- Do not invent release claims for early versions that lack reliable per-version notes.

See plan.md for the active phases and progress.md for completed work.
