# Implementation Plan — Issue #112: Empty web-search response

**Branch:** `fix/112-empty-web-search-response`
**Base:** `origin/main`

## Goal

Return a clear non-empty Grok-native `web_search` result when xAI succeeds without assistant text, while preserving response IDs and existing error behavior.

## Phases

1. [x] Confirm issue scope, branch state, and current dispatcher behavior.
2. [x] Review strict versus display response-text extraction and existing web-search tests.
3. [x] Add the explicit `No results for: <query>` fallback and focused regression coverage.
4. [x] Run focused tests, diagnostics, typecheck, and the full project gate.
5. [x] Perform an independent final diff review.

## Validation Contract

- Successful responses with assistant text remain unchanged.
- Successful responses without assistant text return `No results for: <query>`.
- Successful response IDs remain available in `details.response_id`.
- Opt-in, model, credential, domain-filter, and error paths remain unchanged.
