# Constraints & Safety Rules — PR #101

## Direct file-adapter policy

- Apply lexical and post-`realpath` containment to `read_file`, `search_replace`, and `list_dir`.
- Accept relative paths and absolute paths only when their resolved target stays in the workspace.
- Reject outside absolute paths, escaping traversal, outward symlinks, and unsafe missing leaves.
- Permit creation only when the missing leaf's physical parent already resolves inside the workspace.
- Bound every package-owned full text read used by negative offsets or exact replacement.
- Preserve cancellation, pi's mutation queue, stale-snapshot detection, and in-workspace behavior.

## Explicit non-goals

- Do not constrain or otherwise modify `run_terminal_command`; it delegates to pi `bash`.
- Do not describe this change as a complete filesystem sandbox.
- Do not claim resistance to a concurrent same-user filesystem namespace swap; pi's
  direct adapters remain pathname-based and do not expose descriptor-relative traversal.
- Do not change tool opt-in, credentials, model entitlement, transport, or package version.

## Delivery

- Preserve `safety/pr-101-stale` and force-push only with an exact lease against
  `0f9ca07b71699a933b094a968539fe5739b23d6b`.
- Update PR #101 with factual defense-in-depth wording and fresh validation results.
- Merge only after policy, Socket, and both exact Pi compatibility checks are green.
- Preserve and exclude `.claude/`, `anime-characters.jpg`, and `anime-characters.mp4`.
- Leave PR #88 and issues #85/#86 untouched.
- Use UV instead of pip if Python becomes necessary.
