import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTempDir } from "../fixtures/temp";
const require = createRequire(import.meta.url);
const setup = require("../../bin/setup.js") as {
  getNpmPackageName(source: string): string | undefined;
  pruneDuplicatePackageEntries(entries: any[], settingsPath: string): any;
  updateSettings(path: string): void;
};
let temp: Awaited<ReturnType<typeof createTempDir>>;
let settingsPath: string;
let localXai: string;
let localOther: string;
beforeEach(async () => {
  temp = await createTempDir("pi-xai-setup-");
  settingsPath = join(temp.path, ".pi/agent/settings.json");
  const xai = join(temp.path, "projects/pi-xai-oauth");
  const other = join(temp.path, "projects/other");
  await mkdir(xai, { recursive: true });
  await mkdir(other, { recursive: true });
  await writeFile(
    join(xai, "package.json"),
    JSON.stringify({ name: "pi-xai-oauth" }),
  );
  await writeFile(
    join(other, "package.json"),
    JSON.stringify({ name: "other-pkg" }),
  );
  localXai = "../../projects/pi-xai-oauth";
  localOther = "../../projects/other";
});
afterEach(async () => temp.cleanup());
describe("setup settings", () => {
  it.each([
    ["npm:pi-xai-oauth", "pi-xai-oauth"],
    ["npm:pi-xai-oauth@1.3.0", "pi-xai-oauth"],
    ["npm:@scope/pkg@1.2.3", "@scope/pkg"],
    ["git:github.com/user/repo", undefined],
  ])("parses %s", (source, expected) =>
    expect(setup.getNpmPackageName(source)).toBe(expected),
  );
  it("prunes local duplicates while retaining npm and unrelated entries", () => {
    expect(
      setup.pruneDuplicatePackageEntries(
        [localXai, "npm:pi-xai-oauth", localOther],
        settingsPath,
      ),
    ).toEqual({
      packages: ["npm:pi-xai-oauth", localOther],
      removed: [localXai],
      addedNpmPackage: false,
    });
  });
  it("prunes object local entries and adds npm when absent", () => {
    expect(
      setup.pruneDuplicatePackageEntries(
        [{ source: localXai, extensions: ["./extensions"] }],
        settingsPath,
      ),
    ).toEqual({
      packages: ["npm:pi-xai-oauth"],
      removed: [localXai],
      addedNpmPackage: true,
    });
  });
  it("writes pruned packages and preserves configured defaults", async () => {
    await mkdir(join(settingsPath, ".."), { recursive: true });
    await writeFile(
      settingsPath,
      JSON.stringify({
        packages: [localXai, "npm:pi-xai-oauth"],
        defaultProvider: "xai-auth",
        defaultModel: "grok-4.5",
        defaultThinkingLevel: "high",
        unrelated: true,
      }),
    );
    setup.updateSettings(settingsPath);
    const value = JSON.parse(await readFile(settingsPath, "utf8"));
    expect(value).toMatchObject({
      packages: ["npm:pi-xai-oauth"],
      defaultProvider: "xai-auth",
      defaultModel: "grok-4.5",
      defaultThinkingLevel: "high",
      unrelated: true,
    });
  });
});
