# Constraints & Safety Rules — Issue #114

## Vision-routing policy

- Reapply consumed historical-image pruning after caller payload hooks.
- Preserve current unconsumed user and tool images when routing is authorized.
- Preserve truthful text-only source metadata and final image-free enforcement.
- Keep historical `computer_call_output.output` object-shaped while removing references.
- Keep every routed request bound to the exact grant captured at stream start.

## Security boundaries

- Do not resolve, fetch, log, or reflect historical image references during pruning.
- Do not silently strip hook-added images when vision routing was not captured as enabled.
- Do not send conversation history, tools, or encrypted reasoning to the vision target.
- Keep placeholders fixed and bounded.

## Non-goals

- Do not introduce immutable provenance for hook-reordered history.
- Do not change entitlement selection, OAuth credentials, or package version.
- Do not touch unrelated extensions or tools.
