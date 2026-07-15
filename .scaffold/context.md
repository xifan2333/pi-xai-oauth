# Shared Agent Context

**Project:** pi-xai-oauth
**Branch:** feature/issue-54-paid-xai-tools
**Date:** 2026-07-15

## Key Context
- GitHub #54 reported that `xai_generate_image` was paid, active by default, absent from `/xai-tools`, and unguarded.
- The audit found the same boundary defect in `xai_generate_text`, `xai_code_execution`, `xai_analyze_image`, and `xai_critique`.
- Every helper that sends an additional xAI request is now a session-scoped explicit opt-in.
- Local filesystem and shell compatibility shims remain automatic for eligible Grok CLI models because they do not make an extra xAI request.
- `WebSearch` remains opt-in and is eligible only for Grok Build/Composer models.
- Disabled tools must fail before OAuth credential resolution or network access.

## Current Focus
- Implementation and verification are complete; the branch is ready for commit or PR publication.
- Preserve the unrelated untracked pi session HTML export.

See plan.md for the active phases and progress.md for completed work.
