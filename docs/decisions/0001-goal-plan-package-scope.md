# ADR 0001: Keep goal and plan workflows out of `pi-xai-oauth`

- **Status:** Accepted
- **Date:** 2026-07-16
- **Last reviewed:** 2026-07-19
- **Issue:** [#85](https://github.com/BlockedPath/pi-xai-oauth/issues/85)
- **Decision owners:** `pi-xai-oauth` maintainers

## Context

Grok-style `/goal` and `/plan` workflows can improve agentic coding, but they do not require xAI OAuth, an xAI model entitlement, the Grok CLI proxy, or another provider capability owned by this package. Installing an authentication provider should not silently install an autonomous task controller, an authoritative workspace plan-file protocol, or a write-restriction policy.

This package owns the xAI-specific integration needed to use entitled Grok models through Pi: authentication and credentials, account-specific catalogs, transport and payload behavior, Grok-native compatibility adapters, opt-in network tools, and media integrations. Goal state, plan approval, task continuation, generic subagent orchestration, and sandbox policy are provider-neutral concerns.

This record compares three locations for those workflows:

1. inside `pi-xai-oauth`;
2. in a separately installed provider-neutral package;
3. in existing provider-neutral Pi extensions and prompt templates.

The decision was initially researched against Pi 0.80.7 and was revalidated against this repository's current tested boundary, Pi 0.80.10. Third-party packages named below are examples to evaluate, not endorsements or permanent compatibility claims.

## Decision

**Do not implement generic `/goal` or `/plan` commands, runtime plan-file management, autonomous continuation, generic task/subagent orchestration, or plan-mode write restriction in `pi-xai-oauth`.** This is a decisive no-go for this package.

Users should first evaluate Pi's prompt templates and official reference extensions or separately installed provider-neutral packages. Examples include:

- [`@narumitw/pi-goal`](https://www.npmjs.com/package/@narumitw/pi-goal) for goal lifecycle and continuation;
- [`@plannotator/pi-extension`](https://www.npmjs.com/package/@plannotator/pi-extension) for plan authoring and human review;
- [`@mjasnikovs/pi-task`](https://www.npmjs.com/package/@mjasnikovs/pi-task) for spec/task orchestration;
- [`pi-subagents`](https://www.npmjs.com/package/pi-subagents) or Pi's [subagent reference example](https://github.com/earendil-works/pi/tree/v0.80.10/packages/coding-agent/examples/extensions/subagent) for delegated work;
- Pi [prompt templates](https://github.com/earendil-works/pi/blob/v0.80.10/packages/coding-agent/docs/prompt-templates.md) for lightweight, stateless planning prompts.

These candidates must be assessed against the user's workflow and threat model. A package that changes active tools or filters shell strings is not thereby a read-only sandbox.

If existing extensions cannot satisfy a concrete requirement, any new implementation must be proposed as a separate provider-neutral Pi package with its own issue tracker, release cycle, security statement, compatibility policy, and tests. No implementation follow-up is opened from #85 because implementation in this repository is not approved.

## Options considered

| Option | Fit | Security and failure isolation | Maintenance | Decision |
| --- | --- | --- | --- | --- |
| Add workflows to `pi-xai-oauth` | Poor. The behavior is not xAI-specific. | Worst. Every OAuth install would load autonomous control and tool-policy code in the same privileged Pi process. | A second state machine permanently coupled to the provider compatibility matrix. | **Rejected.** |
| Create a separate provider-neutral package | Acceptable only for a proven unmet need and explicit installation. | Better package and release isolation, but still not an OS security boundary. | Its own state, persistence, UI, security policy, releases, and cross-provider tests. | **Deferred, not approved.** |
| Reuse existing generic extensions/templates | Best current fit. Pi already exposes the required generic primitives and reference implementations. | Users choose the package and threat model explicitly. Strong isolation still requires an external boundary. | No runtime or compatibility burden in this repository. | **Chosen first.** |

## Relevant Pi APIs and ecosystem

Pi 0.80.10 already exposes provider-neutral primitives for a workflow package:

- Commands, tools, flags, and shortcuts: `registerCommand`, `registerTool`, `registerFlag`, and `registerShortcut`.
- Prompt and tool control: `input`, `before_agent_start`, `context`, `sendMessage`, `sendUserMessage`, `getActiveTools`, `setActiveTools`, and `getAllTools`.
- Completion state: the distinct `agent_end`, `agent_settled`, and `turn_end` events, plus `ctx.isIdle()` and pending-message checks. `ctx.waitForIdle()` is available to user-invoked command contexts rather than every lifecycle handler.
- Cancellation: optional tool `AbortSignal` and `ctx.signal`, `ctx.abort()`, event-specific cancellation results or signals, generation guards when no signal is available, and `session_shutdown` cleanup.
- Persistence and recovery: extension-owned entries through `appendEntry`, read-only session-manager access, and `session_start`, `session_before_switch`, `session_before_fork`, `session_before_compact`, `session_compact`, `session_before_tree`, `session_tree`, and `session_shutdown` events.
- Composition: package prompt templates, skills, extensions, and the in-process `pi.events` bus.

The authoritative inventory is Pi's [extension documentation](https://github.com/earendil-works/pi/blob/v0.80.10/packages/coding-agent/docs/extensions.md), [session format](https://github.com/earendil-works/pi/blob/v0.80.10/packages/coding-agent/docs/session-format.md), [package format](https://github.com/earendil-works/pi/blob/v0.80.10/packages/coding-agent/docs/packages.md), and official [plan-mode](https://github.com/earendil-works/pi/tree/v0.80.10/packages/coding-agent/examples/extensions/plan-mode), [todo](https://github.com/earendil-works/pi/blob/v0.80.10/packages/coding-agent/examples/extensions/todo.ts), and [subagent](https://github.com/earendil-works/pi/tree/v0.80.10/packages/coding-agent/examples/extensions/subagent) examples.

The official plan-mode example is API guidance, not a security boundary. Pi's [security model](https://github.com/earendil-works/pi/blob/v0.80.10/packages/coding-agent/docs/security.md) states that Pi and extensions run with the user's permissions and that real isolation must come from an operating-system, container, or VM boundary.

## Requirements for any separate proposal

A future provider-neutral proposal would need to address all of the following before implementation:

### State, concurrency, and recovery

- Keep goal, phase, approval, progress, and continuation state owned by the current Pi session, with versioned persisted transitions that can be rebuilt after resume or branch navigation.
- Treat in-memory controller and UI state as disposable caches and prevent a new session from inheriting another session's active goal implicitly.
- Use revision or generation guards so delayed completions, calls, and continuations from replaced or cancelled work become stale no-ops.
- Keep optional human-readable plan files non-authoritative. If sessions share one, use atomic replacement and explicit conflict detection rather than last-writer-wins.
- Propagate cancellation through model calls, fetches, timers, child processes, and nested agents; make shutdown cleanup idempotent.
- Pause ambiguous in-flight side effects for recovery instead of automatically repeating commands whose completion is unknown.
- Keep credentials, authenticated headers, and provider internals out of workflow state and plan files.

### Security model

Hiding `edit` and `write`, filtering shell strings, or changing Pi's active-tool list is insufficient to enforce read-only behavior. A same-process extension cannot provide that guarantee because shell and child processes, third-party and MCP tools, other extensions, remote services, and privileged extension code can all produce side effects outside a registered tool call.

This repository provides a concrete example: Grok-native `run_terminal_command` delegates to Pi's `bash` tool and may access paths outside the workspace. The direct file adapters' containment checks are defense in depth, not a complete filesystem sandbox.

A future package must therefore document one of two honest modes:

1. **Advisory planning:** best-effort prompts, tool filtering, and per-command approval, explicitly labeled as workflow behavior rather than a security guarantee.
2. **Enforced read-only planning:** the planning agent and every tool run behind an independently enforced sandbox, container, VM, or equivalent boundary with a read-only workspace, minimal credentials, and restricted network access.

`pi-xai-oauth` will implement neither mode because neither belongs to provider authentication or routing.

### Provider and test scope

Goal and plan behavior must work equivalently with xAI and non-xAI models. Model-specific prompt tuning may be an adapter, but provider identity cannot own the command namespace, persistence format, transitions, cancellation semantics, or security policy.

A separate implementation would require focused coverage for state transitions, stale generations, resume and branch navigation, concurrent file conflicts, crash recovery, cancellation at await boundaries, descendant cleanup, built-in/extension/MCP/shell side effects, and equivalent behavior with xAI and at least one non-xAI provider. It would also need its own package compatibility and release policy.

An exception can be reconsidered only for a small capability that requires xAI OAuth or entitlement state and cannot be represented through a provider-neutral interface. No requirement identified in #85 meets that test.

## Consequences

### Positive

- OAuth installation remains focused and predictable.
- Provider credentials, catalog state, routing, tools, and media behavior are not coupled to autonomous workflow state.
- This package does not make a false read-only security claim.
- Users can compose the provider with the generic workflow that matches their needs.
- Workflow packages can evolve across providers without forcing an xAI provider release.

### Negative

- `pi-xai-oauth` does not provide a single-install Grok-flavored `/goal` or `/plan` experience.
- Users who want those workflows must select another package or prompt template.
- Existing packages differ in persistence, review UI, cancellation, and security posture, so users must evaluate them.

### Scope guard

Future PRs adding generic goal/plan commands, runtime plan files, autonomous continuation, write restriction, or generic task/subagent orchestration to this repository should be closed unless this ADR is explicitly superseded by a new decision with evidence of an xAI-specific requirement and a complete security model.
