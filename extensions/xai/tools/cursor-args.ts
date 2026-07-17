import { lstat, realpath } from "node:fs/promises";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";

/** Coerce Cursor/Grok CLI-style tool arguments into an object. */
export function objectFromCursorArgs(value: unknown): Record<string, any> {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value as Record<string, any>;
  if (typeof value !== "string") return {};
  const trimmed = value.trim();
  if (!trimmed) return {};
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, any>;
  } catch {
    // Plain string arguments are common in hand-written tool calls; callers
    // decide whether that string should be treated as a path, pattern, command, etc.
  }
  return { value: trimmed };
}

/** Return the first non-empty string-like argument. */
export function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value;
  }
  return undefined;
}

function firstNumber(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}

function firstBoolean(...values: unknown[]): boolean | undefined {
  for (const value of values) {
    if (typeof value === "boolean") return value;
    if (typeof value === "string" && value.trim()) {
      const normalized = value.trim().toLowerCase();
      if (["true", "1", "yes", "y"].includes(normalized)) return true;
      if (["false", "0", "no", "n"].includes(normalized)) return false;
    }
  }
  return undefined;
}

function cursorPath(params: Record<string, any>): string | undefined {
  return firstString(params.path, params.file_path, params.filePath, params.target_file, params.targetFile, params.value);
}

function cursorContent(params: Record<string, any>): string | undefined {
  return firstString(params.content, params.contents, params.text, params.value);
}

function cursorOldText(params: Record<string, any>): string | undefined {
  return firstString(params.oldText, params.old_text, params.old_string, params.oldString, params.old, params.target);
}

function cursorNewText(params: Record<string, any>): string | undefined {
  return firstString(params.newText, params.new_text, params.new_string, params.newString, params.new, params.replacement);
}

function cursorSearchPattern(params: Record<string, any>): string | undefined {
  return firstString(params.pattern, params.query, params.regex, params.substring, params.value);
}

function cursorGlob(params: Record<string, any>): string | undefined {
  return firstString(params.glob, params.include, params.glob_pattern, params.globPattern, params.glob_filter, params.globFilter, params.filter);
}

/** Normalize arguments for the Cursor/Grok CLI Read shim. */
export function normalizeReadArgs(args: unknown) {
  const params = objectFromCursorArgs(args);
  return {
    path: cursorPath(params) || "",
    offset: firstNumber(params.offset, params.start_line, params.startLine),
    limit: firstNumber(params.limit, params.max_lines, params.maxLines),
  };
}

/** Normalize arguments for the Cursor/Grok CLI Write shim. */
export function normalizeWriteArgs(args: unknown) {
  const params = objectFromCursorArgs(args);
  return {
    path: cursorPath(params) || "",
    content: cursorContent(params) ?? "",
  };
}

/** Normalize arguments for the Cursor/Grok CLI Edit/StrReplace shims. */
export function normalizeEditArgs(args: unknown) {
  const params = objectFromCursorArgs(args);
  if (Array.isArray(params.edits)) {
    return {
      path: cursorPath(params) || "",
      edits: params.edits.map((edit: unknown) => {
        const item = objectFromCursorArgs(edit);
        return { oldText: cursorOldText(item) || "", newText: cursorNewText(item) ?? "" };
      }),
    };
  }
  return {
    path: cursorPath(params) || "",
    edits: [{ oldText: cursorOldText(params) || "", newText: cursorNewText(params) ?? "" }],
  };
}

/** Normalize arguments for the Cursor/Grok CLI Grep shim. */
export function normalizeGrepArgs(args: unknown) {
  const params = objectFromCursorArgs(args);
  const pattern = cursorSearchPattern(params);
  if (!pattern) {
    const received = Object.keys(params).sort().join(", ") || "(none)";
    throw new Error(
      `Grep requires a non-empty pattern (or query alias). Received keys: ${received}`,
    );
  }
  return {
    pattern,
    path: firstString(params.path, params.directory, params.dir, params.folder, params.file_path, params.filePath),
    glob: cursorGlob(params),
    ignoreCase: firstBoolean(params.ignoreCase, params.ignore_case, params.case_insensitive, params.caseInsensitive),
    literal: firstBoolean(params.literal, params.fixed_strings, params.fixedStrings),
    context: firstNumber(params.context, params.context_lines, params.contextLines),
    limit: firstNumber(params.limit, params.max_results, params.maxResults),
  };
}

/** Normalize arguments for the Cursor/Grok CLI Glob shim. */
export function normalizeGlobArgs(args: unknown) {
  const params = objectFromCursorArgs(args);
  return {
    pattern: firstString(params.pattern, params.glob, params.glob_pattern, params.globPattern, params.query, params.value) || "**/*",
    path: firstString(params.path, params.directory, params.dir, params.folder),
    limit: firstNumber(params.limit, params.max_results, params.maxResults),
  };
}

/** Normalize arguments for the Cursor/Grok CLI LS shim. */
export function normalizeLsArgs(args: unknown) {
  const params = objectFromCursorArgs(args);
  return {
    path: cursorPath(params),
    limit: firstNumber(params.limit, params.max_results, params.maxResults),
  };
}

/** Normalize arguments for the Cursor/Grok CLI Shell shim. */
export function normalizeShellArgs(args: unknown) {
  const params = objectFromCursorArgs(args);
  return {
    command: firstString(params.command, params.cmd, params.value) || "",
    timeout: firstNumber(params.timeout, params.timeout_ms, params.timeoutMs),
  };
}

/** Normalize arguments for the Cursor/Grok CLI Delete shim. */
export function normalizeDeleteArgs(args: unknown) {
  const params = objectFromCursorArgs(args);
  return {
    path: cursorPath(params) || "",
    recursive: firstBoolean(params.recursive, params.directory, params.dir),
  };
}

/**
 * Resolve a requested path while refusing operations outside the workspace.
 *
 * The workspace root itself is allowed (for whole-tree reads such as Grep).
 * Destructive tools must use {@link safeWorkspaceChildPath} instead.
 */
export function safeWorkspacePath(cwd: string, requestedPath: string): string {
  const resolved = isAbsolute(requestedPath) ? resolve(requestedPath) : resolve(cwd, requestedPath);
  const workspace = resolve(cwd);
  const workspaceRelativePath = relative(workspace, resolved);
  if (workspaceRelativePath.startsWith("..") || isAbsolute(workspaceRelativePath)) {
    throw new Error(`Refusing to operate outside the workspace: ${requestedPath}`);
  }
  return resolved;
}

function isOutsideWorkspace(workspace: string, candidate: string): boolean {
  const difference = relative(workspace, candidate);
  return difference === ".."
    || difference.startsWith(`..${sep}`)
    || isAbsolute(difference);
}

/** Return whether two already-resolved paths identify the same platform path. */
export function isSameResolvedPath(
  firstPath: string,
  secondPath: string,
  relativePath: (from: string, to: string) => string = relative,
): boolean {
  return relativePath(firstPath, secondPath) === "";
}

/**
 * Resolve a destructive target whose physical location must remain below the
 * workspace root.
 *
 * Intermediate links are resolved before containment is checked. A link in the
 * final path component is returned without following it so Delete unlinks the
 * link rather than its target.
 */
export async function safeWorkspaceChildPath(
  cwd: string,
  requestedPath: string,
): Promise<string> {
  const resolved = safeWorkspacePath(cwd, requestedPath);
  const workspace = resolve(cwd);
  if (isSameResolvedPath(workspace, resolved)) {
    throw new Error(`Refusing to operate on the workspace root: ${requestedPath}`);
  }

  const [physicalWorkspace, physicalParent] = await Promise.all([
    realpath(workspace),
    realpath(dirname(resolved)),
  ]);
  if (isOutsideWorkspace(physicalWorkspace, physicalParent)) {
    throw new Error(`Refusing to operate outside the workspace: ${requestedPath}`);
  }

  const physicalCandidate = join(physicalParent, basename(resolved));
  const candidateInfo = await lstat(physicalCandidate);
  if (candidateInfo.isSymbolicLink()) return physicalCandidate;

  const physicalTarget = await realpath(physicalCandidate);
  const physicalDifference = relative(physicalWorkspace, physicalTarget);
  if (physicalDifference === "") {
    throw new Error(`Refusing to operate on the workspace root: ${requestedPath}`);
  }
  if (isOutsideWorkspace(physicalWorkspace, physicalTarget)) {
    throw new Error(`Refusing to operate outside the workspace: ${requestedPath}`);
  }
  return physicalTarget;
}
