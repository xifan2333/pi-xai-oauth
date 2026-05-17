# pi-xai-oauth

**One-command installer for xAI (Grok) OAuth + Grok 4.3 in pi**

```bash
npx pi-xai-oauth
```

Adds full Grok 4.3 support (1M context, reasoning) with clean OAuth login.

## Features

- Real OAuth login (`/login xai-auth`) with device code flow + refresh tokens
- Uses the modern `openai-responses` API
- Custom tools: `xai_generate_text`, `xai_multi_agent`
- Agentic tools: `xai_web_search`, `xai_x_search`, `xai_code_execution` (experimental placeholders that leverage the xAI model)
- Full reasoning support with thinking levels (`low` / `medium` / `high`)
- Automatic detection of existing `~/.grok/auth.json`

## Installation

**One-command install (recommended):**

```bash
npx pi-xai-oauth
```

This installs the package and guides you through setup.

**Manual install:**

```bash
pi install npm:pi-xai-oauth
```

## Usage

After installing, authenticate using:

```bash
pi /login xai-auth
```

Then select any supported Grok model with `/model` or `--model`.

## Supported Models

- `grok-4.3` (1M context, default)
- `grok-4.20-0309-reasoning`
- `grok-4.20-0309-non-reasoning`

All models support extended thinking with levels: `low`, `medium`, `high`.

## Quick Reference

| Action                    | Command                              |
|---------------------------|--------------------------------------|
| Install                   | `pi install npm:pi-xai-oauth`        |
| Try without installing    | `pi -e npm:pi-xai-oauth`             |
| Update                    | `pi update npm:pi-xai-oauth`         |
| Remove                    | `pi remove npm:pi-xai-oauth`         |
| List installed packages   | `pi list`                            |

## Authentication

Run:

```bash
pi /login xai-auth
```

Pi displays the same xAI OAuth endpoint used by the official Grok CLI (`https://auth.x.ai/oauth2/authorize`) and listens on `127.0.0.1:56121/callback` for the redirect. Copy the shown URL into the browser/profile you want to use. After approval, it stores OAuth access/refresh tokens and refreshes them automatically.

If official Grok CLI credentials already exist in `~/.grok/auth.json`, Pi can reuse them. This is separate from creating an `xai-...` API key in the xAI API console.

## Updating the Package

```bash
# 1. Bump version in package.json
# 2. Publish new version
npm publish
```

Users can update with:

```bash
pi update npm:pi-xai-oauth
```
