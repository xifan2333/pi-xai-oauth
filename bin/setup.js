#!/usr/bin/env node

/**
 * pi-xai-oauth — One-command installer for xAI (Grok) OAuth + Grok 4.3
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

const NPM_SPEC = "npm:pi-xai-oauth";
const SETTINGS_PATH = path.join(os.homedir(), ".pi/agent/settings.json");

// ANSI colors
const colors = {
  green: "\x1b[32m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  reset: "\x1b[0m",
  bold: "\x1b[1m",
};

function color(text, c) {
  return `${colors[c] || ""}${text}${colors.reset}`;
}

function printHeader() {
  console.log(`\n${color("🚀  pi-xai-oauth", "cyan")} — ${color("xAI Grok 4.3 + OAuth for pi", "bold")}\n`);
  console.log("   One-command setup for Grok 4.3 (1M context) with clean OAuth login.\n");
}

function checkPi() {
  try {
    execSync("which pi", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function installPackage() {
  console.log(color("📦 Installing pi-xai-oauth into pi...", "cyan"));
  try {
    execSync(`pi install ${NPM_SPEC}`, { stdio: "inherit" });
    console.log(color("\n✅ Package installed successfully!", "green"));
    return true;
  } catch (err) {
    console.error(color("\n❌ Failed to run 'pi install'.", "red"));
    console.log(`Please run manually:  ${color(`pi install ${NPM_SPEC}`, "yellow")}`);
    return false;
  }
}

function updateSettings() {
  console.log(color("\n⚙️  Configuring pi settings...", "cyan"));

  let settings = {};

  if (fs.existsSync(SETTINGS_PATH)) {
    try {
      settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf8"));
    } catch (e) {
      console.log(color("   Warning: Could not parse existing settings.json", "yellow"));
    }
  }

  let changed = false;

  // Ensure packages array exists
  if (!Array.isArray(settings.packages)) {
    settings.packages = [];
  }

  // Add the package if not already present
  const hasPackage = settings.packages.some(p => {
    if (typeof p === "string") return p === NPM_SPEC;
    if (p && typeof p === "object") return p.source === NPM_SPEC;
    return false;
  });

  if (!hasPackage) {
    settings.packages.push(NPM_SPEC);
    changed = true;
    console.log(color("   + Added npm:pi-xai-oauth to packages", "green"));
  }

  // Set recommended defaults for Grok 4.3 experience
  if (settings.defaultProvider !== "xai-oauth") {
    settings.defaultProvider = "xai-oauth";
    changed = true;
    console.log(color("   + Set defaultProvider: xai-oauth", "green"));
  }

  if (settings.defaultModel !== "grok-4.3") {
    settings.defaultModel = "grok-4.3";
    changed = true;
    console.log(color("   + Set defaultModel: grok-4.3", "green"));
  }

  if (settings.defaultThinkingLevel !== "high") {
    settings.defaultThinkingLevel = "high";
    changed = true;
    console.log(color("   + Set defaultThinkingLevel: high", "green"));
  }

  if (changed) {
    try {
      const dir = path.dirname(SETTINGS_PATH);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
      console.log(color("   ✅ Settings updated!", "green"));
    } catch (e) {
      console.log(color("   ⚠️  Could not write settings.json (you can configure manually)", "yellow"));
    }
  } else {
    console.log(color("   (Settings already configured)", "reset"));
  }
}

function main() {
  printHeader();

  const args = process.argv.slice(2);
  const yes = args.includes("--yes") || args.includes("-y");

  if (!checkPi()) {
    console.log(color("❌ 'pi' command not found in PATH.", "red"));
    console.log("Please install pi first → https://pi.dev\n");
    process.exit(1);
  }

  const success = installPackage();
  if (success) {
    updateSettings();
    printNextSteps(yes);
  }
}

function printNextSteps(nonInteractive = false) {
  console.log(`\n${color("🎉  Setup complete!", "green")}\n`);

  if (!nonInteractive) {
    console.log("Next steps:\n");
    console.log(`   ${color("1.", "bold")} Authenticate with xAI OAuth:`);
    console.log(`      ${color("pi /login xai-oauth", "cyan")}\n`);
    console.log(`   ${color("2.", "bold")} Start chatting with Grok 4.3 (already set as default)`);
    console.log(`      ${color("pi", "cyan")}\n`);
  } else {
    console.log("Grok 4.3 + xAI OAuth is now configured and ready.\n");
  }

  console.log("You now have access to powerful reasoning + 1M context!\n");
  console.log("Bonus tools available:");
  console.log("   • xai_generate_text     — Generate text with full reasoning");
  console.log("   • xai_multi_agent       — Multi-agent research");
  console.log("   • xai_web_search        — Web search powered by Grok");
  console.log("   • xai_x_search          — X/Twitter search");
  console.log("   • xai_code_execution    — Python code analysis & execution\n");
  console.log(`   Update later: ${color("pi update npm:pi-xai-oauth", "yellow")}\n`);
}

main();
