import { isAbsolute, relative, resolve, sep } from "node:path";

/** Coerce model tool arguments into an object, including JSON-string calls. */
export function objectFromGrokToolArgs(value: unknown): Record<string, any> {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value as Record<string, any>;
  if (typeof value !== "string") return {};
  const trimmed = value.trim();
  if (!trimmed) return {};
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, any>;
    }
  } catch {
    // A plain string is accepted as the primary path/pattern/command value.
  }
  return { value: trimmed };
}

/** Return the first non-empty string argument. */
export function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value;
  }
  return undefined;
}

function firstStringValue(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string") return value;
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

function firstInteger(label: string, ...values: unknown[]): number | undefined {
  const value = firstNumber(...values);
  if (value === undefined) return undefined;
  if (!Number.isSafeInteger(value)) throw new Error(`${label} must be an integer`);
  return value;
}

function firstBoolean(...values: unknown[]): boolean | undefined {
  for (const value of values) {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") {
      if (value === 1) return true;
      if (value === 0) return false;
    }
    if (typeof value === "string" && value.trim()) {
      const normalized = value.trim().toLowerCase();
      if (["true", "1", "yes", "y"].includes(normalized)) return true;
      if (["false", "0", "no", "n"].includes(normalized)) return false;
    }
  }
  return undefined;
}

/** Normalize `read_file` arguments to Grok's model-facing contract. */
export function prepareReadFileArgs(args: unknown) {
  const params = objectFromGrokToolArgs(args);
  const targetFile = firstString(
    params.target_file,
    params.targetFile,
    params.path,
    params.file_path,
    params.filePath,
    params.value,
  ) ?? "";
  const offset = firstInteger("read_file offset", params.offset, params.start_line, params.startLine);
  const limit = firstInteger("read_file limit", params.limit, params.max_lines, params.maxLines);
  if (limit !== undefined && limit < 0) throw new Error("read_file limit must be zero or positive");
  const pages = firstStringValue(params.pages);
  const format = firstStringValue(params.format);
  return {
    target_file: targetFile,
    ...(offset === undefined ? {} : { offset }),
    ...(limit === undefined ? {} : { limit }),
    ...(pages === undefined ? {} : { pages }),
    ...(format === undefined ? {} : { format }),
  };
}

/** Convert `read_file` arguments to pi's built-in `read` shape. */
export function readFileArgsForPi(args: unknown) {
  const prepared = prepareReadFileArgs(args);
  return {
    path: prepared.target_file,
    offset: prepared.offset,
    limit: prepared.limit,
  };
}

/** Normalize `search_replace` arguments to Grok's model-facing contract. */
export function prepareSearchReplaceArgs(args: unknown) {
  const params = objectFromGrokToolArgs(args);
  const filePath = firstString(
    params.file_path,
    params.filePath,
    params.path,
    params.target_file,
    params.targetFile,
  ) ?? "";
  const oldString = firstStringValue(
    params.old_string,
    params.oldString,
    params.old_text,
    params.oldText,
    params.old,
  );
  const newString = firstStringValue(
    params.new_string,
    params.newString,
    params.new_text,
    params.newText,
    params.new,
    params.replacement,
  );
  return {
    file_path: filePath,
    old_string: oldString,
    new_string: newString,
    replace_all: firstBoolean(params.replace_all, params.replaceAll) ?? false,
  };
}

/** Convert `search_replace` arguments to pi's built-in edit field names. */
export function searchReplaceArgsForPi(args: unknown) {
  const prepared = prepareSearchReplaceArgs(args);
  return {
    path: prepared.file_path,
    oldText: prepared.old_string,
    newText: prepared.new_string,
    replaceAll: prepared.replace_all,
  };
}

/** Normalize `list_dir` arguments to Grok's model-facing contract. */
export function prepareListDirArgs(args: unknown) {
  const params = objectFromGrokToolArgs(args);
  return {
    target_directory: firstString(
      params.target_directory,
      params.targetDirectory,
      params.path,
      params.directory,
      params.dir,
      params.value,
    ) ?? ".",
  };
}

/** Convert `list_dir` arguments to pi's built-in `ls` shape. */
export function listDirArgsForPi(args: unknown) {
  return { path: prepareListDirArgs(args).target_directory };
}

/** Normalize `grep` arguments to Grok's model-facing contract. */
export function prepareGrepArgs(args: unknown) {
  const params = objectFromGrokToolArgs(args);
  const pattern = firstString(params.pattern, params.query, params.regex, params.substring, params.value);
  if (!pattern) {
    const received = Object.keys(params).sort().join(", ") || "(none)";
    throw new Error(`grep requires a non-empty pattern. Received keys: ${received}`);
  }
  const path = firstString(
    params.path,
    params.directory,
    params.dir,
    params.folder,
    params.file_path,
    params.filePath,
  );
  const glob = firstString(
    params.glob,
    params.include,
    params.glob_pattern,
    params.globPattern,
    params.glob_filter,
    params.globFilter,
    params.filter,
  );
  const beforeContext = firstInteger("grep -B", params["-B"], params.before_context, params.beforeContext);
  const afterContext = firstInteger("grep -A", params["-A"], params.after_context, params.afterContext);
  const context = firstInteger("grep -C", params["-C"], params.context, params.context_lines, params.contextLines);
  const caseInsensitive = firstBoolean(
    params["-i"],
    params.case_insensitive,
    params.caseInsensitive,
    params.ignore_case,
    params.ignoreCase,
  );
  const type = firstString(params.type, params.file_type, params.fileType);
  const headLimit = firstInteger(
    "grep head_limit",
    params.head_limit,
    params.headLimit,
    params.limit,
    params.max_results,
    params.maxResults,
  );
  for (const [name, value] of [["-B", beforeContext], ["-A", afterContext], ["-C", context], ["head_limit", headLimit]] as const) {
    if (value !== undefined && value < 0) throw new Error(`grep ${name} must be zero or positive`);
  }
  const multiline = firstBoolean(params.multiline);
  const outputMode = firstString(params.output_mode, params.outputMode);
  return {
    pattern,
    ...(path === undefined ? {} : { path }),
    ...(glob === undefined ? {} : { glob }),
    ...(beforeContext === undefined ? {} : { "-B": beforeContext }),
    ...(afterContext === undefined ? {} : { "-A": afterContext }),
    ...(context === undefined ? {} : { "-C": context }),
    ...(caseInsensitive === undefined ? {} : { "-i": caseInsensitive }),
    ...(type === undefined ? {} : { type }),
    ...(headLimit === undefined ? {} : { head_limit: headLimit }),
    ...(multiline === undefined ? {} : { multiline }),
    ...(outputMode === undefined ? {} : { output_mode: outputMode }),
  };
}

/** Convert `grep` arguments to the bounded local-search implementation shape. */
export function grepArgsForLocalSearch(args: unknown) {
  const prepared = prepareGrepArgs(args);
  return {
    pattern: prepared.pattern,
    path: prepared.path,
    glob: prepared.glob,
    beforeContext: prepared["-B"],
    afterContext: prepared["-A"],
    context: prepared["-C"],
    ignoreCase: prepared["-i"],
    type: prepared.type,
    limit: prepared.head_limit,
    multiline: prepared.multiline,
    outputMode: prepared.output_mode,
  };
}

const DEFAULT_GROK_TERMINAL_TIMEOUT_MS = 120_000;
const MAX_GROK_TERMINAL_TIMEOUT_MS = 300_000;

/** Normalize `run_terminal_command` arguments to Grok's client-facing contract. */
export function prepareTerminalCommandArgs(args: unknown) {
  const params = objectFromGrokToolArgs(args);
  const timeout = firstInteger("run_terminal_command timeout", params.timeout, params.timeout_ms, params.timeoutMs);
  return {
    command: firstString(params.command, params.cmd, params.value) ?? "",
    description: firstStringValue(params.description) ?? "",
    background: firstBoolean(params.background, params.is_background, params.isBackground) ?? false,
    ...(timeout === undefined ? {} : { timeout }),
  };
}

/** Convert Grok's millisecond terminal timeout to pi's seconds-based bash shape. */
export function terminalCommandArgsForPi(args: unknown) {
  const prepared = prepareTerminalCommandArgs(args);
  if (prepared.timeout !== undefined && prepared.timeout < 0) {
    throw new Error("run_terminal_command timeout must be zero or a positive number of milliseconds");
  }
  const timeoutMs = prepared.timeout && prepared.timeout > 0
    ? Math.min(prepared.timeout, MAX_GROK_TERMINAL_TIMEOUT_MS)
    : DEFAULT_GROK_TERMINAL_TIMEOUT_MS;
  return {
    command: prepared.command,
    timeout: timeoutMs / 1000,
    background: prepared.background,
  };
}

/** Normalize `web_search` arguments without changing the official domain filter list. */
export function prepareWebSearchArgs(args: unknown) {
  const params = objectFromGrokToolArgs(args);
  let allowedDomains: string[] | undefined;
  if (params.allowed_domains !== undefined) {
    if (!Array.isArray(params.allowed_domains) || params.allowed_domains.some((domain: unknown) => typeof domain !== "string")) {
      throw new Error("web_search allowed_domains must be an array of strings");
    }
    allowedDomains = [...params.allowed_domains];
  }
  return {
    query: firstString(params.query, params.search_term, params.value) ?? "",
    ...(allowedDomains === undefined ? {} : { allowed_domains: allowedDomains }),
  };
}

/** Resolve a requested local-search path while refusing paths outside the workspace. */
export function safeWorkspacePath(cwd: string, requestedPath: string): string {
  const resolved = isAbsolute(requestedPath) ? resolve(requestedPath) : resolve(cwd, requestedPath);
  const workspace = resolve(cwd);
  const workspaceRelativePath = relative(workspace, resolved);
  if (workspaceRelativePath === ".." || workspaceRelativePath.startsWith(`..${sep}`) || isAbsolute(workspaceRelativePath)) {
    throw new Error(`Refusing to operate outside the workspace: ${requestedPath}`);
  }
  return resolved;
}
