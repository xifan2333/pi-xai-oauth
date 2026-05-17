# Constraints & Safety Rules

## Hard Boundaries (MUST NOT)
- Never commit API keys or OAuth tokens
- Never modify files outside this package without explicit delegation
- Never skip TypeScript type checking before edits
- Never use global state — prefer external .scaffold/ files
- Never ignore errors from subagent calls or tool failures

## Required Practices (MUST)
- Always start on a feature branch
- Always read AGENTS.md before starting work
- Use parallel subagents for research + planning when possible
- Update progress.md after every significant step
- Run `git status` and confirm branch before any edit
- Prefer vertical feature organization in new code

## Tool Usage Rules
- Subagent: Prefer PARALLEL mode for independent tasks
- Always specify `cwd` when working in specific directories
- Use `reviewer` agent before merging or finalizing large changes

## Performance & Context Rules
- Keep context under 40% of window when possible
- Externalize plans and progress to reduce token usage
- Use scout for fast recon before deep dives

Update this file whenever new constraints are discovered.
