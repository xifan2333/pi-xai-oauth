#!/usr/bin/env node

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const {
  getNpmPackageName,
  pruneDuplicatePackageEntries,
  updateSettings,
} = require(path.join(repoRoot, "bin", "setup.js"));

function makeFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pi-xai-oauth-setup-"));
  const settingsDir = path.join(root, ".pi", "agent");
  const packageDir = path.join(root, "projects", "pi-xai-oauth");
  const otherDir = path.join(root, "projects", "other-pkg");
  fs.mkdirSync(settingsDir, { recursive: true });
  fs.mkdirSync(packageDir, { recursive: true });
  fs.mkdirSync(otherDir, { recursive: true });
  fs.writeFileSync(path.join(packageDir, "package.json"), JSON.stringify({ name: "pi-xai-oauth" }));
  fs.writeFileSync(path.join(otherDir, "package.json"), JSON.stringify({ name: "other-pkg" }));
  return {
    root,
    settingsPath: path.join(settingsDir, "settings.json"),
    localXai: "../../projects/pi-xai-oauth",
    localOther: "../../projects/other-pkg",
  };
}

(function verifyNpmSpecParsing() {
  assert.equal(getNpmPackageName("npm:pi-xai-oauth"), "pi-xai-oauth");
  assert.equal(getNpmPackageName("npm:pi-xai-oauth@1.3.0"), "pi-xai-oauth");
  assert.equal(getNpmPackageName("npm:@scope/pkg@1.2.3"), "@scope/pkg");
  assert.equal(getNpmPackageName("git:github.com/user/repo"), undefined);
})();

(function verifyLocalDuplicatePruning() {
  const fixture = makeFixture();
  const result = pruneDuplicatePackageEntries([
    fixture.localXai,
    "npm:pi-xai-oauth",
    fixture.localOther,
  ], fixture.settingsPath);

  assert.deepEqual(result.removed, [fixture.localXai]);
  assert.deepEqual(result.packages, ["npm:pi-xai-oauth", fixture.localOther]);
  assert.equal(result.addedNpmPackage, false);
  fs.rmSync(fixture.root, { recursive: true, force: true });
})();

(function verifyObjectLocalDuplicatePruningAndNpmAdd() {
  const fixture = makeFixture();
  const result = pruneDuplicatePackageEntries([
    { source: fixture.localXai, extensions: ["./extensions"] },
  ], fixture.settingsPath);

  assert.deepEqual(result.removed, [fixture.localXai]);
  assert.deepEqual(result.packages, ["npm:pi-xai-oauth"]);
  assert.equal(result.addedNpmPackage, true);
  fs.rmSync(fixture.root, { recursive: true, force: true });
})();

(function verifyUpdateSettingsWritesPrunedConfig() {
  const fixture = makeFixture();
  fs.writeFileSync(fixture.settingsPath, JSON.stringify({
    packages: [fixture.localXai, "npm:pi-xai-oauth"],
    defaultProvider: "xai-auth",
    defaultModel: "grok-4.3",
    defaultThinkingLevel: "high",
  }));

  updateSettings(fixture.settingsPath);
  const settings = JSON.parse(fs.readFileSync(fixture.settingsPath, "utf8"));
  assert.deepEqual(settings.packages, ["npm:pi-xai-oauth"]);
  fs.rmSync(fixture.root, { recursive: true, force: true });
})();

console.log("verify-setup: ok");
