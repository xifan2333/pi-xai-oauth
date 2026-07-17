#!/usr/bin/env node

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const previousHome = process.env.HOME;
const previousAgentDir = process.env.PI_CODING_AGENT_DIR;
const home = await mkdtemp(join(tmpdir(), "pi-xai-loader-"));
try {
  process.env.HOME = home;
  process.env.PI_CODING_AGENT_DIR = join(home, ".pi", "agent");
  const packageMain = fileURLToPath(import.meta.resolve("@earendil-works/pi-coding-agent"));
  const loaderUrl = pathToFileURL(join(dirname(packageMain), "core", "extensions", "loader.js")).href;
  const { createExtensionRuntime, loadExtensions } = await import(loaderUrl);
  const runtime = createExtensionRuntime();
  const result = await loadExtensions([join(repoRoot, "extensions", "xai-oauth.ts")], repoRoot, undefined, runtime);
  assert.deepEqual(result.errors, [], "real Pi loader should load the extension without errors");
  assert.equal(result.extensions.length, 1, "real Pi loader should load exactly one extension");
  const loaded = result.extensions[0];
  assert.ok(loaded.tools.has("xai_generate_text"), "representative xAI tool should be registered");
  assert.ok(loaded.tools.has("xai_edit_image"), "bounded xAI image-edit tool should be registered");
  assert.ok(loaded.tools.has("Grep"), "representative Cursor shim should be registered");
  assert.ok(loaded.commands.has("xai-tools"), "/xai-tools should be registered");
  assert.equal(runtime.pendingProviderRegistrations.length, 1, "one provider should be queued");
  const provider = runtime.pendingProviderRegistrations[0];
  assert.equal(provider.name, "xai-auth");
  assert.equal(provider.config.api, "xai-responses");
  assert.equal(provider.config.baseUrl, "https://cli-chat-proxy.grok.com/v1");
  assert.deepEqual(provider.config.models.map((model) => model.id), ["grok-4.5"]);
  console.log("verify-extension-loader: ok");
} finally {
  if (previousHome === undefined) delete process.env.HOME;
  else process.env.HOME = previousHome;
  if (previousAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
  else process.env.PI_CODING_AGENT_DIR = previousAgentDir;
  await rm(home, { recursive: true, force: true });
}
