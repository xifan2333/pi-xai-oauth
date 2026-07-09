import { existsSync, readFileSync, realpathSync } from "fs";
import { extname, isAbsolute, relative, resolve } from "path";
import { fileURLToPath } from "url";

export interface NormalizeXaiImageInputOptions {
  cwd?: string;
}

function stripShellQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    trimmed.length >= 2 &&
    ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'")))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function unescapeShellPath(value: string): string {
  // Users often paste paths copied from a shell prompt, e.g. /tmp/My\ File.png.
  return stripShellQuotes(value).replace(/\\([\\\s'"()&;@])/g, "$1");
}

function imageMimeTypeForPath(path: string): string {
  switch (extname(path).toLowerCase()) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    default:
      throw new Error("xAI image understanding supports local .jpg, .jpeg, and .png files only");
  }
}

function assertInsideWorkspace(workspace: string, localPath: string, originalValue: string): string {
  const workspaceRealPath = realpathSync(workspace);
  const localRealPath = realpathSync(localPath);
  const workspaceRelativePath = relative(workspaceRealPath, localRealPath);
  if (workspaceRelativePath.startsWith("..") || isAbsolute(workspaceRelativePath)) {
    throw new Error(`Refusing to read image outside the workspace: ${originalValue}`);
  }
  return localRealPath;
}

function resolveLocalImagePath(value: string, options: NormalizeXaiImageInputOptions): string | undefined {
  const cleaned = unescapeShellPath(value);
  if (!cleaned) return undefined;

  let localPath: string | undefined;
  if (cleaned.startsWith("file://")) {
    try {
      localPath = fileURLToPath(cleaned);
    } catch {
      return undefined;
    }
  } else {
    if (!options.cwd) {
      throw new Error("Local image paths require an explicit workspace");
    }
    localPath = isAbsolute(cleaned) ? resolve(cleaned) : resolve(options.cwd, cleaned);
  }

  if (!existsSync(localPath)) return undefined;
  if (!options.cwd) {
    throw new Error("Local image paths require an explicit workspace");
  }
  return assertInsideWorkspace(options.cwd, localPath, cleaned);
}

/** Normalize an image URL/path into an xAI-compatible URL or data URI. */
export function normalizeXaiImageInput(value: unknown, options: NormalizeXaiImageInputOptions = {}): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const cleaned = stripShellQuotes(value);

  if (/^https?:\/\//i.test(cleaned) || /^data:image\//i.test(cleaned)) {
    return cleaned;
  }

  const localPath = resolveLocalImagePath(cleaned, options);
  if (!localPath) {
    throw new Error(`Image file does not exist or is not a valid URL: ${cleaned}`);
  }

  const mimeType = imageMimeTypeForPath(localPath);
  const data = readFileSync(localPath).toString("base64");
  return `data:${mimeType};base64,${data}`;
}
