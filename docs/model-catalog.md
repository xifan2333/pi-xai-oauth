# Model Catalog Maintenance

Last checked: 2026-07-09

Primary source of truth:

- xAI Models docs: https://docs.x.ai/developers/models
- xAI Pricing docs: https://docs.x.ai/developers/pricing
- Grok CLI / Build behavior should be verified against the current Grok CLI package or traffic before changing CLI-proxy-only entries.

Current official xAI API docs list `grok-4.5` as the default code/chat model with a 500K-token context window, configurable reasoning, and text/image input. Keep `extensions/xai/models.ts` aligned with that page for public API models.

This package also includes OAuth/Grok CLI compatibility entries such as `grok-build`, `grok-composer-2.5-fast`, and Grok 4.20 variants. Treat those as intentional OAuth/CLI deltas: do not remove or rename them solely because they are absent from the public xAI API model page. Update them only after verifying the current Grok CLI proxy model IDs, headers, context limits, and routing behavior.
