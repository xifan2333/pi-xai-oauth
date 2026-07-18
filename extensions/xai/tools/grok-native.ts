import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  createBashToolDefinition,
  createLsToolDefinition,
  createReadToolDefinition,
  createWriteToolDefinition,
} from "@earendil-works/pi-coding-agent";
import type { Api, Model } from "@earendil-works/pi-ai";
import { lstat, readdir, readFile, realpath } from "node:fs/promises";
import { Worker } from "node:worker_threads";
import { extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { Type } from "typebox";
import { resolveXaiCredential } from "../auth";
import {
  XAI_GROK_NATIVE_AUTO_TOOL_NAMES,
  XAI_GROK_NATIVE_TOOL_NAME_MAP,
  XAI_GROK_NATIVE_WEB_SEARCH_DISPATCH_NAME,
  XAI_GROK_NATIVE_WEB_SEARCH_NAME,
  XAI_PROVIDER_ID,
} from "../constants";
import { createXaiResponse } from "../responses";
import { extractResponsesText, messageFromError, statusFromError } from "../text";
import { xaiToolError } from "./common";
import {
  grepArgsForLocalSearch,
  listDirArgsForPi,
  prepareGrepArgs,
  prepareListDirArgs,
  prepareReadFileArgs,
  prepareSearchReplaceArgs,
  prepareTerminalCommandArgs,
  prepareWebSearchArgs,
  readFileArgsForPi,
  safeWorkspacePath,
  searchReplaceArgsForPi,
  terminalCommandArgsForPi,
} from "./grok-native-args";
import { isXaiNetworkToolActive } from "./model-scope";

const DEFAULT_GROK_GREP_LIMIT = 200;
const MAX_GROK_GREP_LIMIT = 2_000;
const DEFAULT_GROK_GREP_ENTRY_LIMIT = 500;
const MAX_GROK_GREP_ENTRY_LIMIT = 10_000;
const MAX_GROK_REGEX_LENGTH = 500;
const MAX_GROK_GREP_CONTEXT_LINES = 20;
const MAX_GROK_GREP_FILE_BYTES = 5_000_000;
const MAX_GROK_GREP_TOTAL_BYTES = 100_000_000;
const MAX_GROK_GREP_OUTPUT_BYTES = 40 * 1024;
const MAX_GROK_GREP_LINE_CHARS = 1_000;
const GROK_GREP_TIMEOUT_MS = 20_000;
const SKIPPED_SEARCH_DIRS = new Set([".git", ".omp", "node_modules"]);

const GROK_GREP_FILE_TYPES: Readonly<Record<string, readonly string[]>> = {
  c: [".c", ".h"],
  cpp: [".cc", ".cpp", ".cxx", ".hh", ".hpp", ".hxx"],
  csharp: [".cs"],
  go: [".go"],
  java: [".java"],
  js: [".js", ".jsx", ".mjs", ".cjs"],
  json: [".json", ".jsonc"],
  kotlin: [".kt", ".kts"],
  markdown: [".md", ".mdx"],
  php: [".php"],
  py: [".py", ".pyi"],
  ruby: [".rb"],
  rust: [".rs"],
  shell: [".sh", ".bash", ".zsh", ".fish"],
  swift: [".swift"],
  toml: [".toml"],
  ts: [".ts", ".tsx", ".mts", ".cts"],
  yaml: [".yaml", ".yml"],
};

const readFileSchema = Type.Object({
  target_file: Type.String({
    minLength: 1,
    description: "Path to the file, relative to the workspace or absolute.",
  }),
  offset: Type.Optional(Type.Integer({ description: "The line number to start reading from." })),
  limit: Type.Optional(Type.Integer({ description: "The number of lines to read." })),
  pages: Type.Optional(Type.String({
    description: "Page range for PDF files, such as 1-5, 3, or 10-.",
  })),
  format: Type.Optional(Type.String({
    description: "PDF output format: image (default) or text.",
  })),
});

const searchReplaceSchema = Type.Object({
  file_path: Type.String({ minLength: 1, description: "Path to the file to modify." }),
  old_string: Type.String({
    description: "Exact text to replace. Use an empty string to create or overwrite a file.",
  }),
  new_string: Type.String({ description: "Replacement text." }),
  replace_all: Type.Optional(Type.Boolean({
    description: "Replace every non-overlapping occurrence instead of requiring one unique match.",
  })),
});

const listDirSchema = Type.Object({
  target_directory: Type.String({
    minLength: 1,
    description: "Directory to list, relative to the workspace or absolute.",
  }),
});

const grepSchema = Type.Object({
  pattern: Type.String({
    minLength: 1,
    description: "Regular expression to search for in file contents.",
  }),
  path: Type.Optional(Type.String({ description: "File or directory to search; defaults to the workspace." })),
  glob: Type.Optional(Type.String({ description: "Glob filter such as *.ts or src/**/*.ts." })),
  "-B": Type.Optional(Type.Integer({ minimum: 0, description: "Context lines before each match." })),
  "-A": Type.Optional(Type.Integer({ minimum: 0, description: "Context lines after each match." })),
  "-C": Type.Optional(Type.Integer({ minimum: 0, description: "Context lines before and after each match." })),
  "-i": Type.Optional(Type.Boolean({ description: "Use case-insensitive matching." })),
  type: Type.Optional(Type.String({
    description: "Common file type filter: ts, js, py, rust, go, java, json, yaml, and similar.",
  })),
  head_limit: Type.Optional(Type.Integer({
    minimum: 0,
    description: `Maximum output lines (default ${DEFAULT_GROK_GREP_LIMIT}).`,
  })),
  multiline: Type.Optional(Type.Boolean({
    description: "Enable multiline mode where . matches newlines.",
  })),
});

const terminalCommandSchema = Type.Object({
  command: Type.String({ minLength: 1, description: "Shell command to execute." }),
  timeout: Type.Optional(Type.Integer({
    minimum: 0,
    maximum: 300_000,
    description: "Timeout in milliseconds (default 120000; maximum 300000).",
  })),
  description: Type.String({
    minLength: 1,
    description: "One sentence explaining why the command contributes to the goal.",
  }),
  background: Type.Optional(Type.Boolean({
    description: "Must be false: pi has no managed background-task lifecycle for extension tools.",
  })),
});

const webSearchSchema = Type.Object({
  query: Type.String({ minLength: 1, description: "The search query to perform." }),
  allowed_domains: Type.Optional(Type.Array(
    Type.String(),
    { description: "Optional domains to restrict the search to." },
  )),
});

function toPosixPath(filePath: string): string {
  return filePath.split(sep).join("/");
}

function escapeRegExpChar(char: string): string {
  return /[\\^$+?.()|[\]{}]/.test(char) ? `\\${char}` : char;
}

function globToRegExp(pattern: string): RegExp {
  let source = "";
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];
    if (char === "*") {
      if (pattern[index + 1] === "*") {
        index += 1;
        if (pattern[index + 1] === "/") {
          index += 1;
          source += "(?:.*/)?";
        } else {
          source += ".*";
        }
      } else {
        source += "[^/]*";
      }
    } else if (char === "?") {
      source += "[^/]";
    } else {
      source += escapeRegExpChar(char);
    }
  }
  return new RegExp(`^${source}$`);
}

function globMatches(pattern: string | undefined, relativePath: string): boolean {
  const normalizedPattern = toPosixPath(pattern || "**/*");
  const normalizedPath = toPosixPath(relativePath);
  const matchTarget = normalizedPattern.includes("/")
    ? normalizedPath
    : normalizedPath.split("/").pop() || normalizedPath;
  return globToRegExp(normalizedPattern).test(matchTarget);
}

function throwIfAborted(signal: AbortSignal | undefined) {
  if (signal?.aborted) throw new Error("Operation aborted");
}

function isRegexQuantifierStart(char: string | undefined): boolean {
  return char === "*" || char === "+" || char === "?" || char === "{";
}

function hasUnsafeRegexStructure(pattern: string): boolean {
  let inCharacterClass = false;
  const groupStack: Array<{ hasQuantifier: boolean; hasAlternation: boolean }> = [];

  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];
    if (char === "\\") {
      if (/\d/.test(pattern[index + 1] || "")) return true;
      index += 1;
      continue;
    }
    if (inCharacterClass) {
      if (char === "]") inCharacterClass = false;
      continue;
    }
    if (char === "[") {
      inCharacterClass = true;
      continue;
    }
    if (char === "(") {
      groupStack.push({ hasQuantifier: false, hasAlternation: false });
      continue;
    }
    if (char === "|") {
      const current = groupStack[groupStack.length - 1];
      if (current) current.hasAlternation = true;
      continue;
    }
    if (char === ")") {
      const group = groupStack.pop();
      if (group && (group.hasQuantifier || group.hasAlternation) && isRegexQuantifierStart(pattern[index + 1])) {
        return true;
      }
      continue;
    }
    if (isRegexQuantifierStart(char)) {
      const current = groupStack[groupStack.length - 1];
      if (current) current.hasQuantifier = true;
    }
  }

  return false;
}

function createSafeRegexMatcher(
  pattern: string,
  ignoreCase: boolean,
  multiline = false,
): RegExp {
  if (pattern.length > MAX_GROK_REGEX_LENGTH) {
    throw new Error(`Regex pattern exceeds maximum length of ${MAX_GROK_REGEX_LENGTH} characters`);
  }
  if (hasUnsafeRegexStructure(pattern)) {
    throw new Error(
      "Unsafe regex pattern: nested quantifiers, quantified alternation, and backreferences are not supported",
    );
  }
  try {
    const flags = `${ignoreCase ? "i" : ""}${multiline ? "gms" : ""}`;
    return new RegExp(pattern, flags || undefined);
  } catch (error) {
    throw new Error(`Invalid regex pattern: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function matchesFileType(filePath: string, type: string | undefined): boolean {
  if (!type) return true;
  const extensions = GROK_GREP_FILE_TYPES[type.toLowerCase()];
  if (!extensions) {
    throw new Error(`Unsupported grep file type: ${type}`);
  }
  return extensions.includes(extname(filePath).toLowerCase());
}

function pathIsWithin(rootPath: string, candidatePath: string): boolean {
  const candidateRelativePath = relative(rootPath, candidatePath);
  return candidateRelativePath === ""
    || (candidateRelativePath !== ".."
      && !candidateRelativePath.startsWith(`..${sep}`)
      && !isAbsolute(candidateRelativePath));
}

async function physicalWorkspaceSearchPath(cwd: string, requestedPath: string): Promise<string> {
  const lexicalPath = safeWorkspacePath(cwd, requestedPath);
  const [workspacePath, physicalPath] = await Promise.all([realpath(cwd), realpath(lexicalPath)]);
  if (!pathIsWithin(workspacePath, physicalPath)) {
    throw new Error(`Refusing to operate outside the workspace: ${requestedPath}`);
  }
  return physicalPath;
}

function checkGrepBudget(signal: AbortSignal | undefined, deadline: number): void {
  throwIfAborted(signal);
  if (Date.now() > deadline) throw new Error("grep timed out after 20 seconds");
}

async function collectLocalFiles(
  searchPath: string,
  rootPath: string,
  globPattern: string | undefined,
  fileType: string | undefined,
  signal: AbortSignal | undefined,
  deadline: number,
): Promise<string[]> {
  checkGrepBudget(signal, deadline);
  const info = await lstat(searchPath);
  if (info.isFile()) return matchesFileType(searchPath, fileType) ? [searchPath] : [];
  if (!info.isDirectory()) return [];

  const files: string[] = [];
  async function visit(directory: string): Promise<void> {
    checkGrepBudget(signal, deadline);
    const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      checkGrepBudget(signal, deadline);
      if (entry.isDirectory() && SKIPPED_SEARCH_DIRS.has(entry.name)) continue;
      const absolutePath = join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(absolutePath);
      } else if (entry.isFile()) {
        const relativePath = toPosixPath(relative(rootPath, absolutePath));
        if ((!globPattern || globMatches(globPattern, relativePath)) && matchesFileType(absolutePath, fileType)) {
          files.push(absolutePath);
          if (files.length > MAX_GROK_GREP_ENTRY_LIMIT) {
            throw new Error(`grep file limit exceeded (${MAX_GROK_GREP_ENTRY_LIMIT})`);
          }
        }
      }
    }
  }

  await visit(searchPath);
  return files;
}

function boundedContext(value: number | undefined): number {
  return Math.min(MAX_GROK_GREP_CONTEXT_LINES, Math.max(0, value ?? 0));
}

interface GrepMatchResult {
  count: number;
  ranges: Array<{ start: number; end: number }>;
}

interface GrepWorkerResponse {
  id: number;
  result?: GrepMatchResult;
  error?: boolean;
}

class GrokGrepMatcher {
  private readonly worker = new Worker(
    new URL("./grok-native-grep-worker.mjs", import.meta.url),
  );

  private requestId = 0;

  async find(
    content: string,
    pattern: string,
    ignoreCase: boolean,
    multiline: boolean,
    storedRangeLimit: number,
    signal: AbortSignal | undefined,
    deadline: number,
  ): Promise<GrepMatchResult> {
    checkGrepBudget(signal, deadline);
    const id = ++this.requestId;
    return new Promise<GrepMatchResult>((resolveMatch, rejectMatch) => {
      let settled = false;
      const cleanup = () => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
        this.worker.off("message", onMessage);
        this.worker.off("error", onError);
        this.worker.off("exit", onExit);
      };
      const settle = (error: Error | undefined, result?: GrepMatchResult) => {
        if (settled) return;
        settled = true;
        cleanup();
        if (error) {
          void this.worker.terminate();
          rejectMatch(error);
        } else {
          resolveMatch(result ?? { count: 0, ranges: [] });
        }
      };
      const onMessage = (message: GrepWorkerResponse) => {
        if (message.id !== id) return;
        settle(
          message.error ? new Error("grep matcher rejected the regular expression") : undefined,
          message.result,
        );
      };
      const onError = () => settle(new Error("grep matcher worker failed"));
      const onExit = () => settle(new Error("grep matcher worker stopped unexpectedly"));
      const onAbort = () => settle(new Error("Operation aborted"));
      const timer = setTimeout(
        () => settle(new Error("grep timed out after 20 seconds")),
        Math.max(1, deadline - Date.now()),
      );
      signal?.addEventListener("abort", onAbort, { once: true });
      this.worker.on("message", onMessage);
      this.worker.once("error", onError);
      this.worker.once("exit", onExit);
      try {
        this.worker.postMessage({
          id,
          content,
          pattern,
          ignoreCase,
          multiline,
          storedRangeLimit,
        });
      } catch {
        settle(new Error("grep matcher worker could not accept input"));
      }
    });
  }

  async close(): Promise<void> {
    await this.worker.terminate().catch(() => undefined);
  }
}

function truncateGrepLine(line: string): string {
  return line.length <= MAX_GROK_GREP_LINE_CHARS
    ? line
    : `${line.slice(0, MAX_GROK_GREP_LINE_CHARS - 1)}…`;
}

async function runLocalGrep(
  cwd: string,
  params: ReturnType<typeof grepArgsForLocalSearch>,
  signal: AbortSignal | undefined,
) {
  const deadline = Date.now() + GROK_GREP_TIMEOUT_MS;
  checkGrepBudget(signal, deadline);
  const requestedPath = params.path || ".";
  const searchPath = await physicalWorkspaceSearchPath(cwd, requestedPath).catch((error) => {
    if (error instanceof Error && /outside the workspace/.test(error.message)) throw error;
    throw new Error(`Path not found: ${safeWorkspacePath(cwd, requestedPath)}`);
  });
  const searchInfo = await lstat(searchPath);
  const outputMode = params.outputMode ?? "content";
  if (!["content", "files_with_matches", "count"].includes(outputMode)) {
    throw new Error(`Unsupported grep output_mode: ${outputMode}`);
  }
  const entryMode = outputMode !== "content";
  const defaultLimit = entryMode ? DEFAULT_GROK_GREP_ENTRY_LIMIT : DEFAULT_GROK_GREP_LIMIT;
  const maximumLimit = entryMode ? MAX_GROK_GREP_ENTRY_LIMIT : MAX_GROK_GREP_LIMIT;
  const limit = Math.min(maximumLimit, params.limit ?? defaultLimit);
  const sharedContext = boundedContext(params.context);
  const beforeContext = boundedContext(params.beforeContext ?? sharedContext);
  const afterContext = boundedContext(params.afterContext ?? sharedContext);
  const files = await collectLocalFiles(
    searchPath,
    searchPath,
    params.glob,
    params.type,
    signal,
    deadline,
  );
  const outputLines: string[] = [];
  let outputBytes = 0;
  let outputCount = 0;
  let matched = false;
  let limitReached = false;
  let byteLimitReached = false;
  let scanLimitReached = false;
  let totalScannedBytes = 0;

  const appendOutputLine = (line: string): boolean => {
    const bytes = Buffer.byteLength(`${outputLines.length > 0 ? "\n" : ""}${line}`, "utf8");
    if (outputBytes + bytes > MAX_GROK_GREP_OUTPUT_BYTES) {
      byteLimitReached = true;
      return false;
    }
    outputLines.push(line);
    outputBytes += bytes;
    outputCount += 1;
    return true;
  };

  createSafeRegexMatcher(params.pattern, !!params.ignoreCase, !!params.multiline);
  const matcherWorker = new GrokGrepMatcher();
  try {
    for (const filePath of files) {
    checkGrepBudget(signal, deadline);
    if (limit > 0 && outputCount >= limit) {
      limitReached = true;
      break;
    }
    const info = await lstat(filePath).catch(() => undefined);
    if (!info?.isFile() || info.size > MAX_GROK_GREP_FILE_BYTES) continue;
    if (totalScannedBytes + info.size > MAX_GROK_GREP_TOTAL_BYTES) {
      scanLimitReached = true;
      break;
    }
    totalScannedBytes += info.size;
    const rawContent = await readFile(filePath, "utf8").catch(() => undefined);
    if (rawContent === undefined) continue;
    checkGrepBudget(signal, deadline);
    const content = rawContent.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const lines = content.split("\n");
    const storedRangeLimit = outputMode === "content" ? limit + 1 : 1;
    const fileMatches = await matcherWorker.find(
      content,
      params.pattern,
      !!params.ignoreCase,
      !!params.multiline,
      storedRangeLimit,
      signal,
      deadline,
    );
    if (fileMatches.count === 0) continue;
    matched = true;
    const displayPath = searchInfo.isDirectory()
      ? toPosixPath(relative(searchPath, filePath))
      : toPosixPath(relative(await realpath(cwd), filePath));

    if (outputMode === "files_with_matches" || outputMode === "count") {
      if (outputCount >= limit) {
        limitReached = true;
        break;
      }
      const line = outputMode === "count" ? `${displayPath}:${fileMatches.count}` : displayPath;
      if (!appendOutputLine(line)) break;
      continue;
    }

    const matchingLines = new Set<number>();
    const outputIndexes = new Set<number>();
    for (const range of fileMatches.ranges) {
      for (let index = range.start; index <= range.end; index += 1) matchingLines.add(index);
      const start = Math.max(0, range.start - beforeContext);
      const end = Math.min(lines.length - 1, range.end + afterContext);
      for (let index = start; index <= end; index += 1) outputIndexes.add(index);
      if (outputIndexes.size > limit) break;
    }
    for (const index of [...outputIndexes].sort((left, right) => left - right)) {
      if (outputCount >= limit) {
        limitReached = true;
        break;
      }
      const separator = matchingLines.has(index) ? ":" : "-";
      const line = `${displayPath}${separator}${index + 1}${separator} ${truncateGrepLine(lines[index])}`;
      if (!appendOutputLine(line)) break;
    }
    if (limitReached || byteLimitReached) break;
    }
  } finally {
    await matcherWorker.close();
  }

  if (!matched) {
    return { content: [{ type: "text" as const, text: "No matches found" }], details: undefined };
  }

  const notices: string[] = [];
  if (limitReached) notices.push(`[${limit} output line limit reached]`);
  if (byteLimitReached) notices.push(`[${MAX_GROK_GREP_OUTPUT_BYTES} byte output limit reached]`);
  if (scanLimitReached) notices.push(`[${MAX_GROK_GREP_TOTAL_BYTES} byte scan limit reached]`);
  const text = [...outputLines, ...(notices.length > 0 ? ["", ...notices] : [])].join("\n");
  return {
    content: [{ type: "text" as const, text }],
    details: notices.length > 0
      ? { outputLimitReached: limitReached, byteLimitReached, scanLimitReached }
      : undefined,
  };
}

function normalizeCrlfForExactMatch(value: string): {
  normalized: string;
  rawBoundaries: number[];
} {
  let normalized = "";
  const rawBoundaries = [0];
  for (let rawIndex = 0; rawIndex < value.length;) {
    if (value[rawIndex] === "\r" && value[rawIndex + 1] === "\n") {
      normalized += "\n";
      rawIndex += 2;
    } else {
      normalized += value[rawIndex];
      rawIndex += 1;
    }
    rawBoundaries.push(rawIndex);
  }
  return { normalized, rawBoundaries };
}

function replacementLineEnding(
  value: string,
  start: number,
  end: number,
): "\n" | "\r\n" {
  const inMatch = value.indexOf("\n", start);
  const newlineIndex = inMatch >= 0 && inMatch < end
    ? inMatch
    : value.indexOf("\n", end);
  if (newlineIndex >= 0) return value[newlineIndex - 1] === "\r" ? "\r\n" : "\n";
  const previous = value.lastIndexOf("\n", Math.max(0, start - 1));
  return previous >= 0 && value[previous - 1] === "\r" ? "\r\n" : "\n";
}

function adaptReplacementLineEndings(value: string, lineEnding: "\n" | "\r\n"): string {
  const normalized = value.replace(/\r\n/g, "\n");
  return lineEnding === "\r\n" ? normalized.replace(/\n/g, "\r\n") : normalized;
}

async function executeSearchReplace(
  toolCallId: string,
  params: unknown,
  signal: AbortSignal | undefined,
  onUpdate: any,
  ctx: any,
) {
  const normalized = searchReplaceArgsForPi(params);
  if (!normalized.path) throw new Error("search_replace requires file_path");
  if (normalized.oldText === undefined) throw new Error("search_replace requires old_string");
  if (normalized.newText === undefined) throw new Error("search_replace requires new_string");
  if (normalized.oldText === normalized.newText) {
    throw new Error("search_replace requires different old_string and new_string values");
  }

  if (normalized.oldText === "") {
    return createWriteToolDefinition(ctx.cwd).execute(
      toolCallId,
      { path: normalized.path, content: normalized.newText },
      signal,
      onUpdate,
      ctx,
    );
  }

  throwIfAborted(signal);
  const absolutePath = isAbsolute(normalized.path)
    ? resolve(normalized.path)
    : resolve(ctx.cwd, normalized.path);
  const rawContent = await readFile(absolutePath, "utf8");
  throwIfAborted(signal);
  const hasBom = rawContent.charCodeAt(0) === 0xfeff;
  const body = hasBom ? rawContent.slice(1) : rawContent;
  const { normalized: matchText, rawBoundaries } = normalizeCrlfForExactMatch(body);
  const oldText = normalized.oldText.replace(/\r\n/g, "\n");
  const positions: number[] = [];
  let searchOffset = 0;
  while (true) {
    const matchOffset = matchText.indexOf(oldText, searchOffset);
    if (matchOffset < 0) break;
    positions.push(matchOffset);
    searchOffset = matchOffset + oldText.length;
  }
  if (positions.length === 0) {
    throw new Error(`search_replace could not find old_string in ${normalized.path}`);
  }
  if (!normalized.replaceAll && positions.length !== 1) {
    throw new Error(
      `search_replace found ${positions.length} occurrences; make old_string unique or set replace_all=true`,
    );
  }

  const selectedPositions = normalized.replaceAll ? positions : positions.slice(0, 1);
  const chunks: string[] = [];
  let rawCursor = 0;
  for (const position of selectedPositions) {
    const rawStart = rawBoundaries[position];
    const rawEnd = rawBoundaries[position + oldText.length];
    chunks.push(body.slice(rawCursor, rawStart));
    chunks.push(adaptReplacementLineEndings(
      normalized.newText,
      replacementLineEnding(body, rawStart, rawEnd),
    ));
    rawCursor = rawEnd;
  }
  chunks.push(body.slice(rawCursor));
  const replacementContent = `${hasBom ? "\ufeff" : ""}${chunks.join("")}`;

  throwIfAborted(signal);
  if (await readFile(absolutePath, "utf8") !== rawContent) {
    throw new Error(`search_replace refused to overwrite a concurrently changed file: ${normalized.path}`);
  }
  const result = await createWriteToolDefinition(ctx.cwd).execute(
    toolCallId,
    { path: normalized.path, content: replacementContent },
    signal,
    onUpdate,
    ctx,
  );
  return {
    ...result,
    content: [{ type: "text" as const, text: `Successfully replaced text in ${normalized.path}` }],
  };
}

async function executeReadFile(
  toolCallId: string,
  params: unknown,
  signal: AbortSignal | undefined,
  onUpdate: any,
  ctx: any,
) {
  const prepared = prepareReadFileArgs(params);
  if (!prepared.target_file) throw new Error("read_file requires target_file");
  if (extname(prepared.target_file).toLowerCase() === ".pdf") {
    throw new Error(
      "read_file PDF pages/format are unavailable in this pi adapter; use a workspace text export",
    );
  }
  const piArgs = readFileArgsForPi(prepared);
  if (prepared.offset !== undefined && prepared.offset < 0) {
    throwIfAborted(signal);
    const absolutePath = isAbsolute(prepared.target_file)
      ? resolve(prepared.target_file)
      : resolve(ctx.cwd, prepared.target_file);
    const content = await readFile(absolutePath, "utf8");
    throwIfAborted(signal);
    const totalFields = content.split("\n").length
      + (content.length > 0 && !content.endsWith("\n") ? 1 : 0);
    piArgs.offset = Math.max(1, totalFields + prepared.offset + 1);
  }
  return createReadToolDefinition(ctx.cwd).execute(
    toolCallId,
    piArgs as any,
    signal,
    onUpdate,
    ctx,
  );
}

function uniqueToolNames(toolNames: string[]): string[] {
  return [...new Set(toolNames)];
}

/** Enable Grok-native local adapters for every active `xai-auth` model. */
export function syncGrokNativeToolsForModel(api: any, model?: Model<Api>) {
  if (typeof api?.getActiveTools !== "function" || typeof api?.setActiveTools !== "function") return;

  let activeTools: string[];
  try {
    const current = api.getActiveTools();
    activeTools = Array.isArray(current) ? (current as string[]) : [];
  } catch {
    // A later model/session hook retries when the registry becomes available.
    return;
  }

  const nativeNames = XAI_GROK_NATIVE_AUTO_TOOL_NAMES as readonly string[];
  const cleaned = activeTools.filter((toolName) => !nativeNames.includes(toolName));
  const nextTools = model?.provider === XAI_PROVIDER_ID
    ? uniqueToolNames([...cleaned, ...nativeNames])
    : cleaned;
  const unchanged = nextTools.length === activeTools.length
    && nextTools.every((toolName, index) => toolName === activeTools[index]);
  if (unchanged) return;

  try {
    api.setActiveTools(nextTools);
  } catch {
    // Ignore transient registry failures; a later synchronization retries.
  }
}

/** Register collision-free pi dispatchers exposed to xAI under Grok's official names. */
export function registerGrokNativeTools(pi: ExtensionAPI) {
  pi.registerTool({
    name: "xai_grok_read_file",
    label: XAI_GROK_NATIVE_TOOL_NAME_MAP.xai_grok_read_file,
    description: "Read a file using Grok's native target_file/offset/limit contract.",
    promptSnippet: "Read a file with target_file and optional offset/limit",
    parameters: readFileSchema,
    prepareArguments: prepareReadFileArgs,
    execute: executeReadFile,
  } as any);

  pi.registerTool({
    name: "xai_grok_search_replace",
    label: XAI_GROK_NATIVE_TOOL_NAME_MAP.xai_grok_search_replace,
    description:
      "Replace exact text in a file. old_string must be unique unless replace_all=true; an empty old_string creates or overwrites the file.",
    promptSnippet: "Replace exact text with file_path, old_string, and new_string",
    parameters: searchReplaceSchema,
    prepareArguments: prepareSearchReplaceArgs,
    execute: executeSearchReplace,
  } as any);

  pi.registerTool({
    name: "xai_grok_list_dir",
    label: XAI_GROK_NATIVE_TOOL_NAME_MAP.xai_grok_list_dir,
    description: "List a directory using Grok's native target_directory contract.",
    promptSnippet: "List a directory with target_directory",
    parameters: listDirSchema,
    prepareArguments: prepareListDirArgs,
    execute: async (toolCallId: string, params: any, signal: any, onUpdate: any, ctx: any) =>
      createLsToolDefinition(ctx.cwd).execute(
        toolCallId,
        listDirArgsForPi(params) as any,
        signal,
        onUpdate,
        ctx,
      ),
  } as any);

  pi.registerTool({
    name: "xai_grok_grep",
    label: XAI_GROK_NATIVE_TOOL_NAME_MAP.xai_grok_grep,
    description:
      "Search file contents with a bounded safe regular expression and Grok-compatible path/glob/context arguments.",
    promptSnippet: "Search file contents with pattern and optional path/glob/context filters",
    parameters: grepSchema,
    prepareArguments: prepareGrepArgs,
    execute: async (_toolCallId: string, params: any, signal: any, _onUpdate: any, ctx: any) =>
      runLocalGrep(ctx.cwd, grepArgsForLocalSearch(params), signal),
  } as any);

  pi.registerTool({
    name: "xai_grok_run_terminal_command",
    label: XAI_GROK_NATIVE_TOOL_NAME_MAP.xai_grok_run_terminal_command,
    description:
      "Run a foreground shell command. timeout is in milliseconds; background=true is rejected because pi has no managed background-task lifecycle.",
    promptSnippet: "Run a foreground shell command with command, description, and optional timeout",
    promptGuidelines: [
      "Use run_terminal_command with background=false; this adapter cannot manage Grok background tasks.",
    ],
    parameters: terminalCommandSchema,
    prepareArguments: prepareTerminalCommandArgs,
    execute: async (toolCallId: string, params: any, signal: any, onUpdate: any, ctx: any) => {
      const normalized = terminalCommandArgsForPi(params);
      if (!normalized.command) throw new Error("run_terminal_command requires command");
      if (normalized.background) {
        throw new Error(
          "run_terminal_command background=true is unavailable: pi has no managed background-task lifecycle",
        );
      }
      return createBashToolDefinition(ctx.cwd).execute(
        toolCallId,
        { command: normalized.command, timeout: normalized.timeout },
        signal,
        onUpdate,
        ctx,
      );
    },
  } as any);

  pi.registerTool({
    name: XAI_GROK_NATIVE_WEB_SEARCH_DISPATCH_NAME,
    label: XAI_GROK_NATIVE_WEB_SEARCH_NAME,
    description:
      "Opt-in paid Grok-native web search. Enable via /xai-tools and call only when the user explicitly requests xAI web search.",
    promptSnippet: "Search the web through xAI with query and optional allowed_domains",
    promptGuidelines: ["Call web_search only when the user explicitly requests xAI web search."],
    parameters: webSearchSchema,
    prepareArguments: prepareWebSearchArgs,
    execute: async (_toolCallId: string, params: any, signal: any, _onUpdate: any, ctx: any) => {
      const { query, allowed_domains: allowedDomains } = prepareWebSearchArgs(params);
      if (!query) return xaiToolError("Error: web_search requires a query.");
      if (ctx?.model?.provider !== XAI_PROVIDER_ID) {
        return xaiToolError(
          "Error: web_search requires an active xAI/Grok model. No xAI request was sent.",
        );
      }
      if (!isXaiNetworkToolActive(pi, XAI_GROK_NATIVE_WEB_SEARCH_DISPATCH_NAME)) {
        return xaiToolError(
          "Error: web_search is disabled. Run /xai-tools to enable it and request it explicitly. No xAI request was sent.",
        );
      }
      const credential = await resolveXaiCredential(ctx);
      if (!credential) {
        return xaiToolError("Error: No xAI OAuth credentials found. Please run the OAuth login first.");
      }

      try {
        const webSearchTool = {
          type: "web_search",
          enable_image_understanding: true,
          ...(allowedDomains ? { filters: { allowed_domains: allowedDomains } } : {}),
        };
        const data = await createXaiResponse(
          credential,
          {
            model: ctx.model.id,
            input: `Search the web for: ${query}\n\nSummarize the key results with sources where available.`,
            tools: [webSearchTool],
          },
          signal,
        );
        return {
          content: [{ type: "text", text: extractResponsesText(data) }],
          details: { response_id: data.id },
        };
      } catch (error) {
        const status = statusFromError(error);
        return xaiToolError(
          `xAI API Error${status ? ` ${status}` : ""}: ${messageFromError(error)}`,
          { error: true, status },
        );
      }
    },
  } as any);
}
