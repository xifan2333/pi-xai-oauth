# Constraints & Safety Rules — PR #96

## Local image policy

- Preserve legacy local PNG/JPEG compatibility only for verified workspace-contained files.
- Reuse shared media limits, inspection, containment policy, and result types.
- Keep `normalizeXaiImageInput` synchronous.
- Keep remote URL and existing data-URL pass-through behavior unchanged.
- Never reflect supplied paths in normalization, filesystem, tool, payload, or routing errors.
- Do not broaden support to unrecognized extensions or unrelated media routes.

## Tool and caller policy

- `xai_generate_text(image_url)` and `xai_analyze_image` must use the active tool `ctx.cwd`.
- Local tool input without a valid workspace context must fail before any outbound request.
- Payload normalization and vision routing remain synchronous and default to `process.cwd()`.
- Do not change tool opt-in, credentials, model entitlement, or transport policy.

## Delivery

- Rebuild PR #96 from current main; do not merge its stale synchronous implementation verbatim.
- Preserve `safety/pr-96-stale` and force-push only with an exact lease against
  `d1c0b11b5f81707831a13bbd2ca0f63f171129a7`.
- Do not change the package version.
- Preserve and exclude `.claude/`, `anime-characters.jpg`, and `anime-characters.mp4`.
- Use UV instead of pip if Python becomes necessary.
